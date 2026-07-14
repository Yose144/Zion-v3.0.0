//! # poc-p2p
//!
//! P2P networking layer for the PoC-lab multi-node simulation.
//!
//! Each [`P2pNode`] wraps a [`NetworkSimulator`] and communicates with peer
//! nodes over synchronous TCP using length-prefixed JSON gossip messages.
//! This is a laboratory-grade implementation — no async runtime, no
//! production cryptography, just simple flooding gossip with TTL-based
//! propagation and message deduplication.
//!
//! ```text
//! ┌──────────┐  TCP   ┌──────────┐  TCP  ┌──────────┐
//! │  Node A  │◀──────▶│  Node B  │◀─────▶│  Node C  │
//! │(simulator)│       │(simulator)│      │(simulator)│
//! └──────────┘       └──────────┘      └──────────┘
//!      │                  │                  │
//!      ▼                  ▼                  ▼
//!  CareProofs         CareProofs         CareProofs
//!  (gossiped)         (gossiped)         (gossiped)
//! ```
//!
//! See `docs/PHASE1_PLAN.md` §4 for the full architecture.

#[cfg(feature = "crypto")]
pub mod crypto;
#[cfg(feature = "crypto")]
pub mod peer_discovery;

pub mod gossip;
pub mod node;
pub mod transport;

pub use gossip::GossipProtocol;
pub use node::{CrossValidationResult, NodeError, P2pNode};
pub use transport::{recv_message, send_message, TcpTransport, TransportError};

#[cfg(feature = "crypto")]
pub use crypto::{CryptoError, EncryptedTransport, KeyExchange, NodeIdentity};
#[cfg(feature = "crypto")]
pub use peer_discovery::{PeerDiscovery, PeerDiscoveryConfig};

// Re-export key types from dependency crates so downstream users only need
// to depend on `poc-p2p`.
pub use poc_core::{
    CareProof, CareScoreComponents, CareTask, Hash, NpuAttestation, ValidationVerdict, ValidatorId,
};
pub use poc_sim::{EpochReport, NetworkSimulator, SimError, SimulatedValidator};
pub use poc_verifier::{cross_validation::cross_validate, CareVerifier, VerifierConfig};

use serde::{Deserialize, Serialize};

/// Messages exchanged between P2P nodes via the gossip protocol.
///
/// All variants are serialised as length-prefixed JSON on the wire (see
/// [`transport::send_message`] / [`transport::recv_message`]).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GossipMessage {
    /// Handshake — announce node identity and capabilities.
    Hello {
        node_id: ValidatorId,
        port: u16,
        version: u8,
    },

    /// Propagate a care proof to peers with a gossip TTL.
    /// When a node receives this, it stores the proof and (if TTL > 0 and
    /// not previously seen) rebroadcasts with TTL − 1.
    CareProofBroadcast {
        proof: CareProof,
        epoch: u64,
        ttl: u8,
    },

    /// Request all proofs for a specific epoch (catch-up sync).
    EpochSyncRequest {
        epoch: u64,
    },

    /// Response to an epoch sync request.
    EpochSyncResponse {
        proofs: Vec<CareProof>,
    },

    /// Cross-validation request — "please verify this proof".
    CrossValidateRequest {
        proof: CareProof,
    },

    /// Cross-validation response with the verdict.
    CrossValidateResponse {
        proof_hash: Hash,
        verdict: ValidationVerdict,
    },

    /// Heartbeat — keep-alive.
    Ping,

    /// Heartbeat response.
    Pong,
}

/// Configuration for a [`P2pNode`].
#[derive(Debug, Clone)]
pub struct P2pConfig {
    /// Port to listen on (0 = OS-assigned).
    pub listen_port: u16,

    /// Maximum number of peer connections.
    pub max_peers: usize,

    /// Default TTL for gossip broadcast messages.
    /// TTL = 2 means a proof propagates 2 hops beyond its origin.
    pub gossip_ttl: u8,

    /// TCP connect timeout in milliseconds.
    pub connect_timeout_ms: u64,

    /// Per-read timeout in milliseconds. Reader threads poll at this
    /// interval so they can check the shutdown flag.
    pub read_timeout_ms: u64,
}

impl Default for P2pConfig {
    fn default() -> Self {
        Self {
            listen_port: 0,
            max_peers: 32,
            gossip_ttl: 2,
            connect_timeout_ms: 5_000,
            read_timeout_ms: 100,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_defaults_sensible() {
        let config = P2pConfig::default();
        assert!(config.max_peers > 0, "max_peers should be positive");
        assert!(config.gossip_ttl > 0, "gossip_ttl should be positive");
        assert!(
            config.connect_timeout_ms > 0,
            "connect_timeout_ms should be positive"
        );
        assert!(config.read_timeout_ms > 0, "read_timeout_ms should be positive");
    }

    #[test]
    fn gossip_message_serde_roundtrip() {
        let msg = GossipMessage::Hello {
            node_id: [1u8; 32],
            port: 9000,
            version: 1,
        };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: GossipMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, decoded);
    }
}
