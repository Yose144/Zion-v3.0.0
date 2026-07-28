//! Error types for zion-issobella.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum IssobellaError {
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Invalid mission status transition: {from} -> {to}")]
    InvalidMissionTransition { from: String, to: String },

    #[error("Mission not found: {0}")]
    MissionNotFound(String),

    #[error("Observation not found: {0}")]
    ObservationNotFound(String),

    #[error("Insufficient funds: required {required}, available {available}")]
    InsufficientFunds { required: u64, available: u64 },

    #[error("L1 RPC error: {0}")]
    L1Rpc(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("{0}")]
    Other(String),
}

pub type IssobellaResult<T> = Result<T, IssobellaError>;
