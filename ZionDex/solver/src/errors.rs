//! Crate-wide error types for the ZionDex Solver Daemon.

use thiserror::Error;

/// All errors produced by the `ziondex-solver` daemon.
#[derive(Debug, Error)]
pub enum Error {
    /// The Router API returned a non-2xx response.
    #[error("router API error: {status} {body}")]
    RouterApi { status: u16, body: String },

    /// The Router returned no viable path for a quote request.
    #[error("no path found for {from} -> {to}")]
    NoPath { from: String, to: String },

    /// A computed bid fell below the intent's minimum output.
    #[error("computed bid {bid} below intent minimum {min}")]
    BidBelowMinimum { bid: String, min: String },

    /// A bid was not found for the requested intent.
    #[error("no bid for intent {0}")]
    BidNotFound(uuid::Uuid),

    /// An intent was not found.
    #[error("intent not found: {0}")]
    IntentNotFound(uuid::Uuid),

    /// The intent deadline has passed.
    #[error("intent {0} expired at {1}")]
    Expired(uuid::Uuid, u64),

    /// An invalid solver private key was supplied.
    #[error("invalid solver key: {0}")]
    InvalidKey(String),

    /// An unknown chain identifier was supplied.
    #[error("unknown chain: {0}")]
    UnknownChain(String),

    /// A solver/execution failure.
    #[error("solver error: {0}")]
    Solver(String),

    /// An HTTP / network error while talking to the Router.
    #[error("http error: {0}")]
    Http(String),

    /// A JSON (de)serialization error.
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    /// A generic internal error.
    #[error("{0}")]
    Other(String),
}

/// Convenience `Result` alias used across the daemon.
pub type Result<T> = std::result::Result<T, Error>;

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        Self::Http(e.to_string())
    }
}

impl From<ethers::providers::ProviderError> for Error {
    fn from(e: ethers::providers::ProviderError) -> Self {
        Self::Other(e.to_string())
    }
}

impl From<std::num::ParseIntError> for Error {
    fn from(e: std::num::ParseIntError) -> Self {
        Self::Other(e.to_string())
    }
}
