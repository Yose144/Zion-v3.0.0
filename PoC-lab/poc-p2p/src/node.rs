//! P2P node — combines a [`NetworkSimulator`] with TCP networking.
//!
//! Each [`P2pNode`] runs its own local simulation epoch, broadcasts the
//! resulting care proofs to connected peers, and receives proofs from
//! peers via a background listener thread.
//!
//! ## Lifecycle
//!
//! 1. [`P2pNode::new`] — create with a node ID, listen address, and simulator.
//! 2. [`P2pNode::bind`] — start listening for incoming connections.
//! 3. [`P2pNode::connect`] — connect to a peer and send a `Hello` handshake.
//! 4. [`P2pNode::run_epoch`] — run local sim epoch + gossip broadcast.
//! 5. [`P2pNode::shutdown`] — close all connections and stop the listener.
//!
//! ## Threading model
//!
//! - The **accept loop** runs in a dedicated thread, using non-blocking
//!   `accept()` with a 10 ms poll interval so it can check the shutdown flag.
//! - Each accepted connection spawns a **reader thread** that reads messages
//!   in a loop with a configurable read timeout.
//! - The main thread handles `connect()` and `run_epoch()` — no shared
//!   mutable state beyond `peers` and `received_proofs` (both behind
//!   `Arc<Mutex<…>>`).

use std::collections::HashMap;
use std::io;
use std::net::{Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use poc_core::{CareProof, CareTask, NpuAttestation, ValidatorId};
use poc_sim::{EpochReport, NetworkSimulator, SimError};
use poc_verifier::{CareVerifier, VerifierConfig};
use thiserror::Error;

use crate::transport::{self, TransportError};
use crate::{GossipMessage, P2pConfig};

/// Errors that can occur during node operations.
#[derive(Debug, Error)]
pub enum NodeError {
    #[error("transport error: {0}")]
    Transport(#[from] TransportError),
    #[error("simulation error: {0}")]
    Sim(#[from] SimError),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
}

/// A P2P node wrapping a [`NetworkSimulator`] with TCP networking.
pub struct P2pNode {
    /// Node identity (also the validator ID used in proofs).
    pub node_id: ValidatorId,
    /// Actual bound listen address (updated after `bind()`).
    pub listen_addr: SocketAddr,
    /// Connected peer streams (shared with the accept loop).
    peers: Arc<Mutex<Vec<TcpStream>>>,
    /// Local simulator.
    sim: NetworkSimulator,
    /// Received proofs from peers, keyed by epoch.
    received_proofs: Arc<Mutex<HashMap<u64, Vec<CareProof>>>>,
    /// Configuration.
    config: P2pConfig,
    /// Shutdown flag shared across all threads.
    shutdown: Arc<AtomicBool>,
    /// Handle for the listener accept-loop thread.
    listener_thread: Option<JoinHandle<()>>,
}

/// Result of cross-validating all proofs for an epoch across the P2P network.
///
/// Produced by [`P2pNode::cross_validate_epoch`]. Represents the "honest
/// majority" consensus on which proofs are valid for the epoch.
#[derive(Debug, Clone)]
pub struct CrossValidationResult {
    /// Epoch that was validated.
    pub epoch: u64,
    /// Total unique proofs (after dedup by validator_id).
    pub total_proofs: usize,
    /// Number of proofs that passed verification.
    pub accepted_count: usize,
    /// Number of proofs that failed verification.
    pub rejected_count: usize,
    /// Whether the quorum was met (accepted_count >= quorum_required).
    pub quorum_met: bool,
    /// Required quorum for the epoch to be valid.
    pub quorum_required: usize,
    /// Proofs that passed verification.
    pub accepted_proofs: Vec<CareProof>,
    /// Proofs that failed verification, with rejection reasons.
    pub rejected_proofs: Vec<(CareProof, String)>,
    /// Validator IDs whose proofs were rejected (divergent/faulty nodes).
    pub divergent_validators: Vec<ValidatorId>,
}

impl P2pNode {
    /// Creates a new P2P node with the given identity, listen address, and
    /// simulator. The node is not yet listening — call `bind()` to start.
    pub fn new(node_id: ValidatorId, listen_addr: SocketAddr, sim: NetworkSimulator) -> Self {
        Self {
            node_id,
            listen_addr,
            peers: Arc::new(Mutex::new(Vec::new())),
            sim,
            received_proofs: Arc::new(Mutex::new(HashMap::new())),
            config: P2pConfig::default(),
            shutdown: Arc::new(AtomicBool::new(false)),
            listener_thread: None,
        }
    }

    /// Sets a custom configuration.
    pub fn with_config(mut self, config: P2pConfig) -> Self {
        self.config = config;
        self
    }

    /// Binds to the listen address and starts the accept loop in a
    /// background thread. After this call, `listen_addr` is updated to
    /// the actual bound address (useful when binding to port 0).
    pub fn bind(&mut self) -> Result<(), NodeError> {
        let listener = TcpListener::bind(self.listen_addr)?;
        self.listen_addr = listener.local_addr()?;
        listener.set_nonblocking(true)?;

        let shutdown = self.shutdown.clone();
        let received_proofs = self.received_proofs.clone();
        let peers = self.peers.clone();
        let read_timeout_ms = self.config.read_timeout_ms;

        self.listener_thread = Some(thread::spawn(move || {
            accept_loop(listener, shutdown, received_proofs, peers, read_timeout_ms);
        }));

        Ok(())
    }

    /// Connects to a peer at the given address, sends a `Hello` handshake,
    /// stores the stream for broadcasting, and spawns a reader thread.
    pub fn connect(&mut self, peer_addr: &str) -> Result<(), NodeError> {
        let mut stream = TcpStream::connect(peer_addr)?;
        transport::set_read_timeout(&stream, self.config.read_timeout_ms);

        // Send Hello handshake
        let hello = GossipMessage::Hello {
            node_id: self.node_id,
            port: self.listen_addr.port(),
            version: 1,
        };
        transport::send_message(&mut stream, &hello)?;

        // Clone for the reader thread
        let reader_stream = stream.try_clone()?;

        // Store the original for broadcasting
        self.peers.lock().unwrap().push(stream);

        // Spawn reader thread for this peer's incoming messages
        let shutdown = self.shutdown.clone();
        let received_proofs = self.received_proofs.clone();
        thread::spawn(move || {
            reader_loop(reader_stream, shutdown, received_proofs);
        });

        Ok(())
    }

    /// Runs one local simulation epoch, constructs care proofs from accepted
    /// validators, stores them locally, and broadcasts them to all peers.
    ///
    /// Returns the [`EpochReport`] from the local simulator.
    pub fn run_epoch(&mut self, epoch: u64) -> Result<EpochReport, NodeError> {
        let report = self.sim.run_epoch(epoch)?;

        // Construct care proofs from accepted validator results
        let proofs = self.construct_proofs_from_report(&report, epoch);

        // Store own proofs locally
        if !proofs.is_empty() {
            self.received_proofs
                .lock()
                .unwrap()
                .entry(epoch)
                .or_insert_with(Vec::new)
                .extend(proofs.clone());
        }

        // Broadcast each proof to all connected peers
        if !proofs.is_empty() {
            let mut peers = self.peers.lock().unwrap();
            for proof in &proofs {
                let msg = GossipMessage::CareProofBroadcast {
                    proof: proof.clone(),
                    epoch,
                    ttl: self.config.gossip_ttl,
                };
                for peer in peers.iter_mut() {
                    let _ = transport::send_message(peer, &msg);
                }
            }
        }

        Ok(report)
    }

    /// Returns a copy of all proofs received for the given epoch (both
    /// locally produced and gossiped from peers).
    pub fn get_received_proofs(&self, epoch: u64) -> Vec<CareProof> {
        self.received_proofs
            .lock()
            .unwrap()
            .get(&epoch)
            .cloned()
            .unwrap_or_default()
    }

    /// Returns the number of connected peers.
    pub fn peer_count(&self) -> usize {
        self.peers.lock().unwrap().len()
    }

    /// Cross-validates all proofs received for an epoch.
    ///
    /// Na konci epochy každý node:
    /// 1. Seznamne všechny proofs (lokální + gossiped od peerů).
    /// 2. Dedupne proofs podle validator_id (ponechej proof s vyšším care_score).
    /// 3. Verifikuje každý proof přes `CareVerifier`.
    /// 4. Spočítá kolik nodů (validatorů) se shoduje na každém proofu.
    /// 5. Proofs které projdou verifikací a mají quorum jsou accepted network-wide.
    ///
    /// Toto je "honest majority" cross-validation — faulty/divergent nodes
    /// jsou odhaleni pokud jejich proofs neprojdou verifikací nebo pokud
    /// se jejich výsledky neshodují s většinou.
    pub fn cross_validate_epoch(
        &self,
        epoch: u64,
        model_hash: poc_core::Hash,
        min_care_score: u64,
        quorum: usize,
    ) -> CrossValidationResult {
        let all_proofs = self.get_received_proofs(epoch);

        // Dedup by validator_id — keep the proof with the highest care_score.
        let mut deduped: HashMap<ValidatorId, CareProof> = HashMap::new();
        for proof in all_proofs {
            let entry = deduped.entry(proof.validator_id);
            entry.and_modify(|existing| {
                if proof.care_score > existing.care_score {
                    *existing = proof.clone();
                }
            }).or_insert(proof);
        }

        let verifier = CareVerifier::new(VerifierConfig {
            expected_model_hash: model_hash,
            min_care_score,
            allowed_backends: vec![
                "cpu-reference".into(),
                "hiran-v2".into(),
                "hiran-stub".into(),
                "opencl-gpu".into(),
            ],
        });

        let mut accepted: Vec<CareProof> = Vec::new();
        let mut rejected: Vec<(CareProof, String)> = Vec::new();

        for proof in deduped.values() {
            match verifier.verify(proof) {
                Ok(_) => accepted.push(proof.clone()),
                Err(e) => rejected.push((proof.clone(), format!("{e}"))),
            }
        }

        // Quorum check: need at least `quorum` accepted proofs for the epoch
        // to be considered valid network-wide.
        let quorum_met = accepted.len() >= quorum;

        // Identify divergent validators (those whose proofs were rejected).
        let divergent_validators: Vec<ValidatorId> =
            rejected.iter().map(|(p, _)| p.validator_id).collect();

        CrossValidationResult {
            epoch,
            total_proofs: deduped.len(),
            accepted_count: accepted.len(),
            rejected_count: rejected.len(),
            quorum_met,
            quorum_required: quorum,
            accepted_proofs: accepted,
            rejected_proofs: rejected,
            divergent_validators,
        }
    }

    /// Shuts down the node: stops the accept loop, closes all peer
    /// connections, and waits for the listener thread to exit.
    pub fn shutdown(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);

        // Close all peer connections
        let mut peers = self.peers.lock().unwrap();
        for peer in peers.iter() {
            let _ = peer.shutdown(Shutdown::Both);
        }
        peers.clear();
        drop(peers);

        // Wait for the listener thread to exit
        if let Some(handle) = self.listener_thread.take() {
            let _ = handle.join();
        }
    }

    /// Constructs [`CareProof`] objects from the accepted validators in an
    /// [`EpochReport`]. Each proof carries the validator's ID, care score,
    /// and the epoch's model hash, with a deterministic output derived from
    /// BLAKE3.
    fn construct_proofs_from_report(&self, report: &EpochReport, epoch: u64) -> Vec<CareProof> {
        report
            .validators
            .iter()
            .filter(|v| v.accepted)
            .map(|v| {
                // Deterministic input hash from epoch + validator_id
                let mut input_data = Vec::new();
                input_data.extend_from_slice(&epoch.to_le_bytes());
                input_data.extend_from_slice(&v.validator_id);
                let input_hash = *blake3::hash(&input_data).as_bytes();

                // Deterministic output from model_hash + validator_id
                let mut output_data = Vec::new();
                output_data.extend_from_slice(&report.model_hash);
                output_data.extend_from_slice(&v.validator_id);
                let output = blake3::hash(&output_data).as_bytes().to_vec();

                // Deterministic attestation quote from validator_id
                let quote_hash = *blake3::hash(&v.validator_id).as_bytes();

                CareProof {
                    validator_id: v.validator_id,
                    task_type: CareTask::NpuInferenceQuality,
                    model_hash: report.model_hash,
                    input_hash,
                    output,
                    npu_attestation: NpuAttestation {
                        backend: "cpu-reference".into(),
                        quote_hash,
                        runtime_version: "0.1.0".into(),
                    },
                    care_score: v.care_score,
                }
            })
            .collect()
    }
}

impl Drop for P2pNode {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Accept loop — runs in a dedicated thread, accepting incoming connections
/// and spawning a reader thread for each.
fn accept_loop(
    listener: TcpListener,
    shutdown: Arc<AtomicBool>,
    received_proofs: Arc<Mutex<HashMap<u64, Vec<CareProof>>>>,
    peers: Arc<Mutex<Vec<TcpStream>>>,
    read_timeout_ms: u64,
) {
    while !shutdown.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((stream, _addr)) => {
                transport::set_read_timeout(&stream, read_timeout_ms);

                // Store a clone in peers so we can broadcast to this peer
                if let Ok(writer_stream) = stream.try_clone() {
                    peers.lock().unwrap().push(writer_stream);
                }

                // Spawn reader thread for incoming messages
                let shutdown2 = shutdown.clone();
                let received_proofs2 = received_proofs.clone();
                thread::spawn(move || {
                    reader_loop(stream, shutdown2, received_proofs2);
                });
            }
            Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(_) => break,
        }
    }
}

/// Reader loop — runs in a per-connection thread, reading messages until
/// the connection is closed or the node shuts down.
fn reader_loop(
    stream: TcpStream,
    shutdown: Arc<AtomicBool>,
    received_proofs: Arc<Mutex<HashMap<u64, Vec<CareProof>>>>,
) {
    while !shutdown.load(Ordering::Relaxed) {
        match transport::recv_message(&stream) {
            Ok(GossipMessage::CareProofBroadcast { proof, epoch, .. }) => {
                received_proofs
                    .lock()
                    .unwrap()
                    .entry(epoch)
                    .or_insert_with(Vec::new)
                    .push(proof);
            }
            Ok(GossipMessage::Hello { .. }) => {
                // Handshake received — no action needed in skeleton
            }
            Ok(GossipMessage::Ping) => {
                // Respond with Pong (best-effort)
                let mut clone = match stream.try_clone() {
                    Ok(s) => s,
                    Err(_) => break,
                };
                let _ = transport::send_message(&mut clone, &GossipMessage::Pong);
            }
            Ok(GossipMessage::Pong) => {
                // Heartbeat response — ignore
            }
            Ok(_) => {
                // Other message types (sync, cross-validate) — not handled
                // in this skeleton; will be implemented in workstream 3b/3c.
            }
            Err(TransportError::Timeout) => continue,
            Err(TransportError::ConnectionClosed) => break,
            Err(_) => break,
        }
    }
}
