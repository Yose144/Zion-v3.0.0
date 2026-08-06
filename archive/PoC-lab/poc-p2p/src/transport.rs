//! Synchronous TCP transport layer for P2P communication.
//!
//! Messages are framed as **length-prefixed JSON**: a 4-byte little-endian
//! length followed by the JSON-serialised [`GossipMessage`]. This is simple,
//! reliable, and sufficient for the laboratory simulation.
//!
//! ```text
//! ┌──────────────┬───────────────────────────────────┐
//! │ len (4 LE)   │  JSON bytes (serde_json)           │
//! └──────────────┴───────────────────────────────────┘
//! ```

use std::io::{self, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::time::Duration;

use thiserror::Error;

use crate::GossipMessage;

/// Safety cap — reject messages larger than 16 MB to prevent malicious
/// or buggy peers from exhausting memory.
const MAX_MESSAGE_SIZE: usize = 16 * 1024 * 1024;

/// Errors that can occur during transport-level operations.
#[derive(Debug, Error)]
pub enum TransportError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("serialization error: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("message too large: {0} bytes (max {1})")]
    MessageTooLarge(usize, usize),
    #[error("connection closed by peer")]
    ConnectionClosed,
    #[error("read timeout")]
    Timeout,
}

/// Synchronous TCP transport — thin wrapper around `std::net`.
pub struct TcpTransport;

impl TcpTransport {
    /// Opens a TCP connection to the given address.
    pub fn connect(addr: &str) -> Result<TcpStream, TransportError> {
        let stream = TcpStream::connect(addr)?;
        Ok(stream)
    }

    /// Creates a `TcpListener` bound to the given address.
    /// Use `"127.0.0.1:0"` for OS-assigned port.
    pub fn listen(addr: &str) -> Result<TcpListener, TransportError> {
        let listener = TcpListener::bind(addr)?;
        Ok(listener)
    }

    /// Returns the actual bound address of a listener (useful when binding
    /// to port 0).
    pub fn local_addr(listener: &TcpListener) -> Result<SocketAddr, TransportError> {
        Ok(listener.local_addr()?)
    }
}

/// Sends a [`GossipMessage`] over a TCP stream as length-prefixed JSON.
///
/// The message is serialised to JSON bytes, prefixed with a 4-byte
/// little-endian length, and written to the stream.
pub fn send_message(stream: &mut TcpStream, msg: &GossipMessage) -> Result<(), TransportError> {
    let json = serde_json::to_vec(msg)?;
    let len = json.len() as u32;
    stream.write_all(&len.to_le_bytes())?;
    stream.write_all(&json)?;
    stream.flush()?;
    Ok(())
}

/// Receives a [`GossipMessage`] from a TCP stream.
///
/// Reads the 4-byte length prefix, then the JSON payload, and deserialises.
/// Handles partial reads, connection resets, and timeouts gracefully.
pub fn recv_message(stream: &TcpStream) -> Result<GossipMessage, TransportError> {
    let mut len_buf = [0u8; 4];
    read_exact(stream, &mut len_buf)?;
    let len = u32::from_le_bytes(len_buf) as usize;
    if len > MAX_MESSAGE_SIZE {
        return Err(TransportError::MessageTooLarge(len, MAX_MESSAGE_SIZE));
    }
    let mut buf = vec![0u8; len];
    read_exact(stream, &mut buf)?;
    let msg = serde_json::from_slice(&buf)?;
    Ok(msg)
}

/// Reads exactly `buf.len()` bytes from the stream, handling partial reads,
/// interruptions, timeouts, and connection resets.
fn read_exact(mut stream: &TcpStream, buf: &mut [u8]) -> Result<(), TransportError> {
    let mut filled = 0;
    while filled < buf.len() {
        match stream.read(&mut buf[filled..]) {
            Ok(0) => return Err(TransportError::ConnectionClosed),
            Ok(n) => filled += n,
            Err(ref e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(ref e) if e.kind() == io::ErrorKind::TimedOut => {
                return Err(TransportError::Timeout);
            }
            Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
                return Err(TransportError::Timeout);
            }
            Err(e) => return Err(TransportError::Io(e)),
        }
    }
    Ok(())
}

/// Convenience: sets a read timeout on a stream (best-effort, ignores errors).
pub fn set_read_timeout(stream: &TcpStream, ms: u64) {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(ms)));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CareProof, CareTask, NpuAttestation};
    use std::thread;

    #[test]
    fn transport_serialize_deserialize() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();

        let handle = thread::spawn(move || {
            let (server, _) = listener.accept().unwrap();
            // Receive two messages in order.
            let msg1 = recv_message(&server).unwrap();
            let msg2 = recv_message(&server).unwrap();
            (msg1, msg2)
        });

        let mut client = TcpStream::connect(addr).unwrap();

        // Simple message
        let ping = GossipMessage::Ping;
        send_message(&mut client, &ping).unwrap();

        // Complex message with a CareProof
        let proof = CareProof {
            validator_id: [1u8; 32],
            task_type: CareTask::NpuInferenceQuality,
            model_hash: [2u8; 32],
            input_hash: [3u8; 32],
            output: vec![0x01, 0x02, 0x03, 0x04],
            npu_attestation: NpuAttestation {
                backend: "cpu-reference".into(),
                quote_hash: [4u8; 32],
                runtime_version: "0.1.0".into(),
            },
            care_score: 2_000_000,
        };
        let broadcast = GossipMessage::CareProofBroadcast {
            proof,
            epoch: 42,
            ttl: 3,
        };
        send_message(&mut client, &broadcast).unwrap();

        let (received1, received2) = handle.join().unwrap();

        assert_eq!(received1, GossipMessage::Ping);
        assert_eq!(received2, broadcast);
    }

    #[test]
    fn transport_connection_closed_detected() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();

        let handle = thread::spawn(move || {
            let (server, _) = listener.accept().unwrap();
            // Peer closes immediately without sending anything.
            // Reading should yield ConnectionClosed.
            let result = recv_message(&server);
            result
        });

        {
            let _client = TcpStream::connect(addr).unwrap();
            // client drops here → connection closed
        }

        let result = handle.join().unwrap();
        assert!(matches!(result, Err(TransportError::ConnectionClosed)));
    }
}
