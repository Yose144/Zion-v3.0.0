//! Gossip protocol — manages message propagation and deduplication.
//!
//! The protocol uses **flooding gossip with TTL**: when a node receives a
//! `CareProofBroadcast`, it stores the proof locally and, if the message
//! has not been seen before and TTL > 0, rebroadcasts it to all peers with
//! TTL − 1. This ensures proofs propagate through the network within a
//! bounded number of hops.
//!
//! Deduplication is based on a BLAKE3 hash of the proof content + epoch
//! (the TTL is intentionally excluded so that the same proof arriving via
//! different paths is only processed once).

use std::collections::HashSet;
use std::net::TcpStream;

use crate::{transport, GossipMessage};

/// Manages gossip message propagation with deduplication.
pub struct GossipProtocol {
    /// Set of message hashes already seen by this node.
    seen: HashSet<[u8; 32]>,
}

impl GossipProtocol {
    /// Creates a new gossip protocol with an empty seen-set.
    pub fn new() -> Self {
        Self {
            seen: HashSet::new(),
        }
    }

    /// Computes a dedup hash for a gossip message.
    ///
    /// For `CareProofBroadcast`, the hash covers the proof content and epoch
    /// but **not** the TTL — this ensures the same proof at the same epoch
    /// is deduplicated regardless of how many hops it has travelled.
    /// For all other message types, the hash covers the full serialised
    /// message.
    pub fn message_hash(msg: &GossipMessage) -> [u8; 32] {
        match msg {
            GossipMessage::CareProofBroadcast { proof, epoch, .. } => {
                let mut data = Vec::new();
                data.extend_from_slice(&proof.hash());
                data.extend_from_slice(&epoch.to_le_bytes());
                *blake3::hash(&data).as_bytes()
            }
            _ => {
                let json = serde_json::to_vec(msg).expect("message serialises");
                *blake3::hash(&json).as_bytes()
            }
        }
    }

    /// Returns `true` if the message should be rebroadcast to peers.
    ///
    /// This checks two conditions:
    /// 1. The message has not been seen before (dedup via hash).
    /// 2. The message is a `CareProofBroadcast` with TTL > 0.
    ///
    /// **Side effect:** the message hash is inserted into the seen-set
    /// regardless of the return value, so subsequent calls for the same
    /// message always return `false`.
    pub fn should_rebroadcast(&mut self, msg: &GossipMessage) -> bool {
        let hash = Self::message_hash(msg);
        if !self.seen.insert(hash) {
            return false; // Already seen
        }
        // Newly seen — check whether it should be rebroadcast.
        match msg {
            GossipMessage::CareProofBroadcast { ttl, .. } => *ttl > 0,
            _ => false,
        }
    }

    /// Broadcasts a message to all connected peers.
    ///
    /// Returns the number of peers the message was successfully sent to.
    /// Errors on individual peers are silently skipped (the peer will be
    /// cleaned up on the next I/O cycle).
    pub fn broadcast(peers: &mut [TcpStream], msg: &GossipMessage) -> usize {
        let mut sent = 0;
        for peer in peers.iter_mut() {
            if transport::send_message(peer, msg).is_ok() {
                sent += 1;
            }
        }
        sent
    }

    /// Creates a copy of a `CareProofBroadcast` message with TTL decremented
    /// by one. Returns `None` if the message is not a broadcast or TTL is
    /// already 0.
    pub fn with_decremented_ttl(msg: &GossipMessage) -> Option<GossipMessage> {
        match msg {
            GossipMessage::CareProofBroadcast { proof, epoch, ttl } => {
                if *ttl == 0 {
                    return None;
                }
                Some(GossipMessage::CareProofBroadcast {
                    proof: proof.clone(),
                    epoch: *epoch,
                    ttl: ttl - 1,
                })
            }
            _ => None,
        }
    }

    /// Clears the seen-set (e.g. between epochs).
    pub fn clear(&mut self) {
        self.seen.clear();
    }

    /// Returns the number of unique messages seen so far.
    pub fn seen_count(&self) -> usize {
        self.seen.len()
    }
}

impl Default for GossipProtocol {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CareProof, CareTask, NpuAttestation};

    fn sample_proof(byte: u8) -> CareProof {
        CareProof {
            validator_id: [byte; 32],
            task_type: CareTask::NpuInferenceQuality,
            model_hash: [2u8; 32],
            input_hash: [3u8; 32],
            output: vec![0x01, 0x02, 0x03],
            npu_attestation: NpuAttestation {
                backend: "cpu-reference".into(),
                quote_hash: [4u8; 32],
                runtime_version: "0.1.0".into(),
            },
            care_score: 2_000_000,
        }
    }

    fn broadcast_msg(proof: CareProof, ttl: u8) -> GossipMessage {
        GossipMessage::CareProofBroadcast {
            proof,
            epoch: 0,
            ttl,
        }
    }

    #[test]
    fn gossip_dedup() {
        let mut gossip = GossipProtocol::new();
        let msg = broadcast_msg(sample_proof(1), 3);

        // First time → should rebroadcast
        assert!(gossip.should_rebroadcast(&msg));
        // Second time → already seen, should NOT rebroadcast
        assert!(!gossip.should_rebroadcast(&msg));
        // Third time → still no
        assert!(!gossip.should_rebroadcast(&msg));

        assert_eq!(gossip.seen_count(), 1);
    }

    #[test]
    fn gossip_ttl_decrement() {
        let msg = broadcast_msg(sample_proof(1), 3);

        // TTL 3 → 2
        let decremented = GossipProtocol::with_decremented_ttl(&msg).unwrap();
        match &decremented {
            GossipMessage::CareProofBroadcast { ttl, .. } => assert_eq!(*ttl, 2),
            _ => panic!("expected CareProofBroadcast"),
        }

        // TTL 2 → 1
        let decremented2 = GossipProtocol::with_decremented_ttl(&decremented).unwrap();
        match &decremented2 {
            GossipMessage::CareProofBroadcast { ttl, .. } => assert_eq!(*ttl, 1),
            _ => panic!("expected CareProofBroadcast"),
        }

        // TTL 1 → 0
        let decremented3 = GossipProtocol::with_decremented_ttl(&decremented2).unwrap();
        match &decremented3 {
            GossipMessage::CareProofBroadcast { ttl, .. } => assert_eq!(*ttl, 0),
            _ => panic!("expected CareProofBroadcast"),
        }

        // TTL 0 → None (stop propagation)
        assert!(GossipProtocol::with_decremented_ttl(&decremented3).is_none());
    }

    #[test]
    fn gossip_ttl_zero_not_rebroadcast() {
        let mut gossip = GossipProtocol::new();
        let msg = broadcast_msg(sample_proof(1), 0);

        // TTL 0 → should not rebroadcast even if new
        assert!(!gossip.should_rebroadcast(&msg));
        // But it should still be marked as seen
        assert_eq!(gossip.seen_count(), 1);
    }

    #[test]
    fn gossip_different_proofs_not_deduped() {
        let mut gossip = GossipProtocol::new();
        let msg_a = broadcast_msg(sample_proof(1), 3);
        let msg_b = broadcast_msg(sample_proof(2), 3);

        assert!(gossip.should_rebroadcast(&msg_a));
        assert!(gossip.should_rebroadcast(&msg_b));
        assert_eq!(gossip.seen_count(), 2);
    }

    #[test]
    fn gossip_same_proof_different_ttl_deduped() {
        let mut gossip = GossipProtocol::new();
        let proof = sample_proof(1);

        let msg_ttl3 = GossipMessage::CareProofBroadcast {
            proof: proof.clone(),
            epoch: 0,
            ttl: 3,
        };
        let msg_ttl2 = GossipMessage::CareProofBroadcast {
            proof: proof.clone(),
            epoch: 0,
            ttl: 2,
        };

        // Same proof, different TTL → should be deduped (hash excludes TTL)
        assert!(gossip.should_rebroadcast(&msg_ttl3));
        assert!(!gossip.should_rebroadcast(&msg_ttl2));
        assert_eq!(gossip.seen_count(), 1);
    }
}
