pub mod connection;
pub mod protocol;

// V2 enhanced modules (server_v2 is primary)
pub mod connection_v2;
pub mod server_v2;

// Re-exports
pub use connection_v2::{Connection, ConnectionState, Protocol};
pub use protocol::{ShareSubmission, StratumError, StratumRequest, StratumResponse, XMRigJob};
pub use server_v2::StratumServer;
