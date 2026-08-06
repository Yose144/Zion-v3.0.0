//! Integration tests for the poc-p2p crate.
//!
//! These tests spawn real P2P nodes on localhost with OS-assigned ports
//! and verify that care proofs are exchanged over the gossip protocol.

use std::thread;
use std::time::Duration;

use poc_core::CareScoreComponents;
use poc_p2p::{NetworkSimulator, P2pNode, SimulatedValidator};
use poc_sim::SimError;

/// Creates a simulator with a single honest validator.
/// All nodes in a cross-validation network must share the same genesis seed
/// so they derive the same model_hash per epoch.
fn single_validator_sim(
    seed_byte: u8,
    validator_byte: u8,
    name: &str,
) -> Result<NetworkSimulator, SimError> {
    let mut sim = NetworkSimulator::new([seed_byte; 32], 1_000_000, 1000, 1_000_000);
    sim.add_validator(SimulatedValidator {
        id: [validator_byte; 32],
        name: name.into(),
        stake: 5000,
        quality: CareScoreComponents {
            accuracy_bps: 9500,
            timeliness_bps: 9000,
            coverage_bps: 8500,
        },
        is_guardian: false,
        ceremony_location: None,
    })?;
    Ok(sim)
}

/// Creates a simulator with a shared genesis seed (for cross-validation tests
/// where all honest nodes must derive the same model_hash).
fn shared_seed_sim(
    genesis_byte: u8,
    validator_byte: u8,
    name: &str,
) -> Result<NetworkSimulator, SimError> {
    single_validator_sim(genesis_byte, validator_byte, name)
}

/// Two nodes on localhost: each runs one epoch with one validator, then
/// we verify that both nodes have received each other's proofs via gossip.
#[test]
fn two_nodes_exchange_proofs() {
    // --- Setup ---
    let sim_a = single_validator_sim(1, 1, "alice").unwrap();
    let sim_b = single_validator_sim(2, 2, "bob").unwrap();

    let mut node_a = P2pNode::new([1u8; 32], "127.0.0.1:0".parse().unwrap(), sim_a);
    let mut node_b = P2pNode::new([2u8; 32], "127.0.0.1:0".parse().unwrap(), sim_b);

    // --- Bind both nodes ---
    node_a.bind().expect("node A bind");
    node_b.bind().expect("node B bind");

    // --- Connect A → B ---
    let b_addr = node_b.listen_addr.to_string();
    node_a.connect(&b_addr).expect("A connects to B");

    // Give B's accept loop time to process the incoming connection
    thread::sleep(Duration::from_millis(150));

    // --- Run one epoch on both nodes ---
    let report_a = node_a.run_epoch(0).expect("node A epoch 0");
    let report_b = node_b.run_epoch(0).expect("node B epoch 0");

    // Both validators should have been accepted by their local simulators
    assert_eq!(report_a.accepted_count(), 1, "alice should be accepted");
    assert_eq!(report_b.accepted_count(), 1, "bob should be accepted");

    // --- Wait for gossip propagation ---
    thread::sleep(Duration::from_millis(300));

    // --- Verify proof exchange ---
    let proofs_a = node_a.get_received_proofs(0);
    let proofs_b = node_b.get_received_proofs(0);

    // Node A should have its own proof (alice) and B's proof (bob)
    let a_has_own = proofs_a.iter().any(|p| p.validator_id == [1u8; 32]);
    let a_has_bobs = proofs_a.iter().any(|p| p.validator_id == [2u8; 32]);
    assert!(
        a_has_own,
        "node A should have its own proof (alice), got {} proofs",
        proofs_a.len()
    );
    assert!(
        a_has_bobs,
        "node A should have bob's proof from gossip, got {} proofs: {:?}",
        proofs_a.len(),
        proofs_a.iter().map(|p| p.validator_id).collect::<Vec<_>>()
    );

    // Node B should have its own proof (bob) and A's proof (alice)
    let b_has_own = proofs_b.iter().any(|p| p.validator_id == [2u8; 32]);
    let b_has_alices = proofs_b.iter().any(|p| p.validator_id == [1u8; 32]);
    assert!(
        b_has_own,
        "node B should have its own proof (bob), got {} proofs",
        proofs_b.len()
    );
    assert!(
        b_has_alices,
        "node B should have alice's proof from gossip, got {} proofs: {:?}",
        proofs_b.len(),
        proofs_b.iter().map(|p| p.validator_id).collect::<Vec<_>>()
    );

    // --- Clean shutdown ---
    node_a.shutdown();
    node_b.shutdown();
}

/// Verifies that a node can bind, connect, and shut down cleanly without
/// hanging or panicking.
#[test]
fn node_bind_connect_shutdown_cycle() {
    let sim = single_validator_sim(3, 3, "carol").unwrap();

    let mut node = P2pNode::new([3u8; 32], "127.0.0.1:0".parse().unwrap(), sim);
    node.bind().expect("bind");
    assert_ne!(node.listen_addr.port(), 0, "OS should assign a non-zero port");

    // No peers connected yet
    assert_eq!(node.peer_count(), 0);

    node.shutdown();
}

/// Verifies that a node with no peers can still run an epoch and store
/// its own proofs locally.
#[test]
fn node_runs_epoch_with_no_peers() {
    let sim = single_validator_sim(4, 4, "dave").unwrap();

    let mut node = P2pNode::new([4u8; 32], "127.0.0.1:0".parse().unwrap(), sim);
    node.bind().expect("bind");

    let report = node.run_epoch(0).expect("epoch");
    assert_eq!(report.accepted_count(), 1);

    // Should have its own proof stored locally
    let proofs = node.get_received_proofs(0);
    assert_eq!(proofs.len(), 1);
    assert_eq!(proofs[0].validator_id, [4u8; 32]);

    node.shutdown();
}

// ── Cross-validation tests ──────────────────────────────────────────────────

/// Three honest nodes run an epoch, exchange proofs via gossip, then
/// cross-validate. All proofs should pass verification and quorum should
/// be met.
#[test]
fn cross_validation_honest_majority() {
    // All honest nodes share genesis seed 10 → same model_hash per epoch.
    let sim_a = shared_seed_sim(10, 10, "alice").unwrap();
    let sim_b = shared_seed_sim(10, 11, "bob").unwrap();
    let sim_c = shared_seed_sim(10, 12, "carol").unwrap();

    let mut node_a = P2pNode::new([10u8; 32], "127.0.0.1:0".parse().unwrap(), sim_a);
    let mut node_b = P2pNode::new([11u8; 32], "127.0.0.1:0".parse().unwrap(), sim_b);
    let mut node_c = P2pNode::new([12u8; 32], "127.0.0.1:0".parse().unwrap(), sim_c);

    node_a.bind().expect("bind A");
    node_b.bind().expect("bind B");
    node_c.bind().expect("bind C");

    // Connect A → B, A → C, B → C (full mesh)
    node_a.connect(&node_b.listen_addr.to_string()).expect("A→B");
    node_a.connect(&node_c.listen_addr.to_string()).expect("A→C");
    node_b.connect(&node_c.listen_addr.to_string()).expect("B→C");

    thread::sleep(Duration::from_millis(200));

    // Run epoch 0 on all nodes
    let report_a = node_a.run_epoch(0).expect("epoch A");
    let report_b = node_b.run_epoch(0).expect("epoch B");
    let report_c = node_c.run_epoch(0).expect("epoch C");

    assert_eq!(report_a.accepted_count(), 1);
    assert_eq!(report_b.accepted_count(), 1);
    assert_eq!(report_c.accepted_count(), 1);

    // Wait for gossip propagation
    thread::sleep(Duration::from_millis(500));

    // Cross-validate on node A — should have proofs from all 3 validators
    let cv_result = node_a.cross_validate_epoch(
        0,
        report_a.model_hash,
        1_000_000, // min_care_score
        2,         // quorum: need at least 2 accepted proofs
    );

    assert!(
        cv_result.total_proofs >= 2,
        "node A should have at least 2 proofs (own + gossiped), got {}",
        cv_result.total_proofs
    );
    assert!(
        cv_result.quorum_met,
        "quorum should be met with honest validators (accepted={}, required={})",
        cv_result.accepted_count,
        cv_result.quorum_required
    );
    assert_eq!(
        cv_result.rejected_count, 0,
        "no proofs should be rejected with honest validators"
    );
    assert!(
        cv_result.divergent_validators.is_empty(),
        "no divergent validators with honest majority"
    );

    node_a.shutdown();
    node_b.shutdown();
    node_c.shutdown();
}

/// Cross-validation with no proofs (empty epoch) — quorum not met.
#[test]
fn cross_validation_empty_epoch_quorum_not_met() {
    let sim = single_validator_sim(20, 20, "solo").unwrap();
    let mut node = P2pNode::new([20u8; 32], "127.0.0.1:0".parse().unwrap(), sim);
    node.bind().expect("bind");

    // Cross-validate epoch 0 without running any epoch first — no proofs.
    let cv_result = node.cross_validate_epoch(0, [99u8; 32], 1_000_000, 1);

    assert_eq!(cv_result.total_proofs, 0);
    assert_eq!(cv_result.accepted_count, 0);
    assert!(!cv_result.quorum_met);

    node.shutdown();
}

/// A single node runs an epoch, then cross-validates with quorum=1.
/// Should pass (it has its own proof).
#[test]
fn cross_validation_single_node_quorum_one() {
    let sim = single_validator_sim(30, 30, "solo").unwrap();
    let mut node = P2pNode::new([30u8; 32], "127.0.0.1:0".parse().unwrap(), sim);
    node.bind().expect("bind");

    let report = node.run_epoch(0).expect("epoch");
    assert_eq!(report.accepted_count(), 1);

    let cv_result = node.cross_validate_epoch(0, report.model_hash, 1_000_000, 1);

    assert_eq!(cv_result.total_proofs, 1);
    assert_eq!(cv_result.accepted_count, 1);
    assert!(cv_result.quorum_met);

    node.shutdown();
}

/// Three nodes: 2 honest + 1 with a bad model hash. The faulty node's
/// proofs should be rejected by cross-validation (model hash mismatch).
#[test]
fn cross_validation_detects_divergent_node() {
    // Honest nodes share genesis seed 40 → same model_hash.
    let sim_a = shared_seed_sim(40, 40, "honest-a").unwrap();
    let sim_b = shared_seed_sim(40, 41, "honest-b").unwrap();
    // "Faulty" node uses a different genesis seed → different model_hash.
    let sim_c = shared_seed_sim(99, 42, "faulty-c").unwrap();

    let mut node_a = P2pNode::new([40u8; 32], "127.0.0.1:0".parse().unwrap(), sim_a);
    let mut node_b = P2pNode::new([41u8; 32], "127.0.0.1:0".parse().unwrap(), sim_b);
    let mut node_c = P2pNode::new([42u8; 32], "127.0.0.1:0".parse().unwrap(), sim_c);

    node_a.bind().expect("bind A");
    node_b.bind().expect("bind B");
    node_c.bind().expect("bind C");

    node_a.connect(&node_b.listen_addr.to_string()).expect("A→B");
    node_a.connect(&node_c.listen_addr.to_string()).expect("A→C");

    thread::sleep(Duration::from_millis(200));

    let report_a = node_a.run_epoch(0).expect("epoch A");
    let _report_b = node_b.run_epoch(0).expect("epoch B");
    let _report_c = node_c.run_epoch(0).expect("epoch C");

    thread::sleep(Duration::from_millis(500));

    // Cross-validate on node A using A's model hash.
    // Node C's proofs will have a different model hash → rejected.
    let cv_result = node_a.cross_validate_epoch(
        0,
        report_a.model_hash,
        1_000_000,
        2, // quorum
    );

    // A and B have the same model hash → their proofs pass.
    // C has a different model hash → its proof is rejected.
    assert!(
        cv_result.accepted_count >= 2,
        "honest nodes A+B should be accepted, got {} accepted",
        cv_result.accepted_count
    );
    assert!(cv_result.quorum_met, "quorum should be met by honest nodes");

    // The faulty node's validator_id should be in divergent_validators
    // (if its proof was received via gossip).
    if cv_result.total_proofs >= 3 {
        assert!(
            !cv_result.divergent_validators.is_empty(),
            "faulty node C should be detected as divergent"
        );
    }

    node_a.shutdown();
    node_b.shutdown();
    node_c.shutdown();
}
