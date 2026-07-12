//! Crate-wide error types.

use thiserror::Error;

/// All errors produced by the `ziondex-intent` crate.
#[derive(Debug, Error)]
pub enum Error {
    /// An intent was not found in the auction engine.
    #[error("intent not found: {0}")]
    IntentNotFound(uuid::Uuid),

    /// A bid was submitted for an intent that is not accepting bids.
    #[error("intent {0} is not accepting bids (status: {1})")]
    NotAcceptingBids(uuid::Uuid, String),

    /// No bids were submitted for an intent before settlement.
    #[error("no bids for intent {0}")]
    NoBids(uuid::Uuid),

    /// A bid's guaranteed output is below the intent's minimum.
    #[error("bid amount_out {amount_out} below min_amount_out {min_amount_out}")]
    BidBelowMinimum {
        amount_out: String,
        min_amount_out: String,
    },

    /// The intent deadline has passed.
    #[error("intent {0} expired at {1}")]
    Expired(uuid::Uuid, u64),

    /// A caller attempted to operate on an intent they do not own.
    #[error("user {0} is not the owner of intent {1}")]
    NotOwner(String, uuid::Uuid),

    /// A replay attempt: an intent with the same (user, nonce) already exists.
    #[error("replay detected: intent with nonce {nonce} already submitted by {user}")]
    Replay { user: String, nonce: u64 },

    /// Signature verification failed.
    #[error("signature verification failed: {0}")]
    BadSignature(String),

    /// An invalid private key / secret key was supplied.
    #[error("invalid key: {0}")]
    InvalidKey(String),

    /// An unknown chain identifier was supplied.
    #[error("unknown chain: {0}")]
    UnknownChain(String),

    /// A solver failed to compute or execute.
    #[error("solver error: {0}")]
    Solver(String),

    /// An HTTP / network error while talking to the Router API.
    #[error("http error: {0}")]
    Http(String),

    /// A JSON (de)serialization error.
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    /// An underlying ethers error.
    #[error("ethers error: {0}")]
    Ethers(String),

    /// A generic internal error.
    #[error("{0}")]
    Other(String),
}

/// Convenience `Result` alias used across the crate.
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

impl From<ed25519_dalek::SignatureError> for Error {
    fn from(e: ed25519_dalek::SignatureError) -> Self {
        Self::BadSignature(e.to_string())
    }
}
