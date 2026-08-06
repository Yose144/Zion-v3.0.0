//! # Peer discovery and reconnection
//!
//! Feature-gated behind `crypto`. Provides:
//!
//! - [`PeerDiscovery`] — manages known peer addresses with failure tracking
//!   and exponential backoff for reconnection.
//! - Gossip-based peer exchange: connected peers share their known peer lists.
//!
//! ## Backoff strategy
//!
//! On connection failure, a peer's backoff doubles (1s → 2s → 4s → ... → max).
//! After a successful connection, the backoff is reset to the initial value.

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::time::{Duration, Instant};

/// Configuration for peer discovery.
#[derive(Debug, Clone)]
pub struct PeerDiscoveryConfig {
    /// Initial backoff duration after first failure.
    pub initial_backoff: Duration,
    /// Maximum backoff duration.
    pub max_backoff: Duration,
    /// How long to remember a peer after it was last seen.
    pub peer_ttl: Duration,
}

impl Default for PeerDiscoveryConfig {
    fn default() -> Self {
        Self {
            initial_backoff: Duration::from_secs(1),
            max_backoff: Duration::from_secs(60),
            peer_ttl: Duration::from_secs(3600),
        }
    }
}

/// Tracks the state of a known peer.
#[derive(Debug, Clone)]
struct PeerState {
    /// Address of the peer.
    addr: SocketAddr,
    /// Number of consecutive connection failures.
    failures: u32,
    /// When the next connection attempt is allowed (after backoff).
    next_attempt: Option<Instant>,
    /// When we last successfully connected to this peer.
    last_seen: Option<Instant>,
}

impl PeerState {
    fn new(addr: SocketAddr) -> Self {
        Self {
            addr,
            failures: 0,
            next_attempt: None,
            last_seen: None,
        }
    }

    /// Returns `true` if this peer is eligible for a connection attempt
    /// (i.e., backoff has expired).
    fn is_eligible(&self) -> bool {
        match self.next_attempt {
            None => true,
            Some(when) => Instant::now() >= when,
        }
    }
}

/// Peer discovery manager — tracks known peers and handles reconnection backoff.
pub struct PeerDiscovery {
    config: PeerDiscoveryConfig,
    peers: HashMap<SocketAddr, PeerState>,
}

impl PeerDiscovery {
    /// Creates a new peer discovery manager from seed peer addresses.
    pub fn from_seeds(seeds: &[SocketAddr]) -> Self {
        let mut peers = HashMap::new();
        for &addr in seeds {
            peers.insert(addr, PeerState::new(addr));
        }
        Self {
            config: PeerDiscoveryConfig::default(),
            peers,
        }
    }

    /// Creates a new peer discovery manager with custom config.
    pub fn with_config(mut self, config: PeerDiscoveryConfig) -> Self {
        self.config = config;
        self
    }

    /// Adds a peer to the known set.
    pub fn add_peer(&mut self, addr: SocketAddr) {
        self.peers.entry(addr).or_insert_with(|| PeerState::new(addr));
    }

    /// Removes a peer from the known set.
    pub fn remove_peer(&mut self, addr: &SocketAddr) {
        self.peers.remove(addr);
    }

    /// Records a successful connection to a peer — resets backoff.
    pub fn record_success(&mut self, addr: &SocketAddr) {
        if let Some(state) = self.peers.get_mut(addr) {
            state.failures = 0;
            state.next_attempt = None;
            state.last_seen = Some(Instant::now());
        }
    }

    /// Records a connection failure — increases backoff.
    pub fn record_failure(&mut self, addr: &SocketAddr) {
        // Get current failure count first (immutable borrow)
        let current_failures = self.peers.get(addr).map(|s| s.failures).unwrap_or(0);
        let new_failures = current_failures + 1;
        let backoff = self.compute_backoff(new_failures);
        let next_attempt = Instant::now() + backoff;

        if let Some(state) = self.peers.get_mut(addr) {
            state.failures = new_failures;
            state.next_attempt = Some(next_attempt);
        }
    }

    /// Computes the backoff duration for a given failure count.
    /// Exponential: initial * 2^(failures-1), capped at max_backoff.
    fn compute_backoff(&self, failures: u32) -> Duration {
        if failures == 0 {
            return self.config.initial_backoff;
        }
        let multiplier = 2u64.saturating_pow(failures - 1);
        let backoff = self.config.initial_backoff * multiplier as u32;
        backoff.min(self.config.max_backoff)
    }

    /// Returns the next peer that is eligible for a connection attempt
    /// (backoff expired). Returns `None` if no peers are eligible.
    pub fn next_peer_to_try(&self) -> Option<SocketAddr> {
        self.peers
            .values()
            .filter(|state| state.is_eligible())
            .map(|state| state.addr)
            .next()
    }

    /// Returns all eligible peers (backoff expired).
    pub fn eligible_peers(&self) -> Vec<SocketAddr> {
        self.peers
            .values()
            .filter(|state| state.is_eligible())
            .map(|state| state.addr)
            .collect()
    }

    /// Returns all known peer addresses (regardless of eligibility).
    pub fn known_peers(&self) -> Vec<SocketAddr> {
        self.peers.keys().copied().collect()
    }

    /// Returns the number of known peers.
    pub fn peer_count(&self) -> usize {
        self.peers.len()
    }

    /// Returns the failure count for a peer (0 if unknown).
    pub fn failures_for(&self, addr: &SocketAddr) -> u32 {
        self.peers.get(addr).map(|s| s.failures).unwrap_or(0)
    }

    /// Returns the backoff duration for a peer (None if no backoff active).
    pub fn backoff_for(&self, addr: &SocketAddr) -> Option<Duration> {
        self.peers.get(addr).and_then(|s| {
            s.next_attempt.map(|when| {
                let now = Instant::now();
                if when > now {
                    when - now
                } else {
                    Duration::ZERO
                }
            })
        })
    }

    /// Merges peer lists received from a connected peer (gossip-based discovery).
    pub fn merge_peers(&mut self, peers: &[SocketAddr]) {
        for &addr in peers {
            self.add_peer(addr);
        }
    }

    /// Removes peers that haven't been seen in `peer_ttl` and have no
    /// successful connection.
    pub fn prune_stale(&mut self) {
        let ttl = self.config.peer_ttl;
        let now = Instant::now();
        self.peers.retain(|_, state| {
            match state.last_seen {
                Some(last) => now.duration_since(last) < ttl,
                None => true, // Never connected but still in seed list — keep
            }
        });
    }
}

impl std::fmt::Debug for PeerDiscovery {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PeerDiscovery")
            .field("peer_count", &self.peers.len())
            .field("config", &self.config)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn addr(port: u16) -> SocketAddr {
        SocketAddr::from_str(&format!("127.0.0.1:{port}")).unwrap()
    }

    #[test]
    fn peer_discovery_from_seeds() {
        let seeds = vec![addr(9000), addr(9001), addr(9002)];
        let pd = PeerDiscovery::from_seeds(&seeds);
        assert_eq!(pd.peer_count(), 3);
        assert_eq!(pd.known_peers().len(), 3);
    }

    #[test]
    fn peer_discovery_add_peer() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]);
        pd.add_peer(addr(9001));
        assert_eq!(pd.peer_count(), 2);
    }

    #[test]
    fn peer_discovery_add_duplicate_is_idempotent() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]);
        pd.add_peer(addr(9000));
        assert_eq!(pd.peer_count(), 1, "adding duplicate should not increase count");
    }

    #[test]
    fn peer_discovery_remove_peer() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000), addr(9001)]);
        pd.remove_peer(&addr(9000));
        assert_eq!(pd.peer_count(), 1);
    }

    #[test]
    fn peer_discovery_all_seeds_eligible_initially() {
        let pd = PeerDiscovery::from_seeds(&[addr(9000), addr(9001)]);
        let eligible = pd.eligible_peers();
        assert_eq!(eligible.len(), 2, "all seeds should be eligible initially");
    }

    #[test]
    fn peer_discovery_backoff_on_failure() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]);
        let a = addr(9000);

        // Before failure: eligible
        assert!(pd.next_peer_to_try().is_some());

        pd.record_failure(&a);
        assert_eq!(pd.failures_for(&a), 1);
        // After failure: not eligible (backoff active)
        assert!(pd.next_peer_to_try().is_none(), "peer should be in backoff");

        // Backoff should be ~1s (initial)
        let backoff = pd.backoff_for(&a).expect("should have backoff");
        assert!(backoff > Duration::from_millis(500), "backoff should be ~1s");
    }

    #[test]
    fn peer_discovery_success_resets_backoff() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]);
        let a = addr(9000);

        pd.record_failure(&a);
        assert!(pd.next_peer_to_try().is_none(), "in backoff");

        pd.record_success(&a);
        assert_eq!(pd.failures_for(&a), 0);
        assert!(pd.next_peer_to_try().is_some(), "should be eligible after success");
        assert!(pd.backoff_for(&a).is_none(), "no backoff after success");
    }

    #[test]
    fn peer_discovery_exponential_backoff() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]).with_config(PeerDiscoveryConfig {
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_secs(10),
            peer_ttl: Duration::from_secs(3600),
        });
        let a = addr(9000);

        pd.record_failure(&a);
        let b1 = pd.backoff_for(&a).unwrap();
        assert!(b1 >= Duration::from_millis(50), "1st backoff ~100ms");

        pd.record_failure(&a);
        let b2 = pd.backoff_for(&a).unwrap();
        assert!(b2 > b1, "2nd backoff should be larger: {b2:?} > {b1:?}");

        pd.record_failure(&a);
        let b3 = pd.backoff_for(&a).unwrap();
        assert!(b3 > b2, "3rd backoff should be larger: {b3:?} > {b2:?}");
    }

    #[test]
    fn peer_discovery_backoff_capped() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]).with_config(PeerDiscoveryConfig {
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_millis(500),
            peer_ttl: Duration::from_secs(3600),
        });
        let a = addr(9000);

        for _ in 0..20 {
            pd.record_failure(&a);
        }
        let backoff = pd.backoff_for(&a).unwrap();
        assert!(
            backoff <= Duration::from_millis(500),
            "backoff must be capped at max: got {backoff:?}"
        );
    }

    #[test]
    fn peer_discovery_merge_peers() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000)]);
        pd.merge_peers(&[addr(9001), addr(9002), addr(9003)]);
        assert_eq!(pd.peer_count(), 4);
    }

    #[test]
    fn peer_discovery_merge_duplicates() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000), addr(9001)]);
        pd.merge_peers(&[addr(9001), addr(9002)]);
        assert_eq!(pd.peer_count(), 3, "merge should not duplicate");
    }

    #[test]
    fn peer_discovery_next_peer_returns_eligible() {
        let mut pd = PeerDiscovery::from_seeds(&[addr(9000), addr(9001), addr(9002)]);
        pd.record_failure(&addr(9000));
        // Only 9001 and 9002 should be eligible
        let eligible = pd.eligible_peers();
        assert_eq!(eligible.len(), 2);
        assert!(!eligible.contains(&addr(9000)));
    }

    #[test]
    fn peer_discovery_empty_seeds() {
        let pd = PeerDiscovery::from_seeds(&[]);
        assert_eq!(pd.peer_count(), 0);
        assert!(pd.next_peer_to_try().is_none());
    }

    #[test]
    fn peer_discovery_prune_stale() {
        let mut pd = PeerDiscovery::from_seeds(&[]).with_config(PeerDiscoveryConfig {
            initial_backoff: Duration::from_secs(1),
            max_backoff: Duration::from_secs(60),
            peer_ttl: Duration::from_millis(1), // very short TTL
        });
        pd.add_peer(addr(9000));
        pd.record_success(&addr(9000));
        // Wait for TTL to expire
        std::thread::sleep(Duration::from_millis(10));
        pd.prune_stale();
        assert_eq!(pd.peer_count(), 0, "stale peer should be pruned");
    }

    #[test]
    fn peer_discovery_prune_keeps_never_connected() {
        let mut pd = PeerDiscovery::from_seeds(&[]).with_config(PeerDiscoveryConfig {
            initial_backoff: Duration::from_secs(1),
            max_backoff: Duration::from_secs(60),
            peer_ttl: Duration::from_millis(1),
        });
        pd.add_peer(addr(9000));
        // Never connected — should not be pruned (it's a seed)
        std::thread::sleep(Duration::from_millis(10));
        pd.prune_stale();
        assert_eq!(pd.peer_count(), 1, "never-connected seed should be kept");
    }
}
