use thiserror::Error;

#[derive(Error, Debug)]
pub enum SdkError {
    #[error("RPC error: {0}")]
    Rpc(String),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("JSON error: {0}")]
    Json(String),

    #[error("Wallet error: {0}")]
    Wallet(String),

    #[error("Not connected to node")]
    NotConnected,

    #[error("Invalid address: {0}")]
    InvalidAddress(String),

    #[error("Insufficient funds: need {needed}, have {available}")]
    InsufficientFunds { needed: u64, available: u64 },
}

pub type SdkResult<T> = Result<T, SdkError>;

impl From<reqwest::Error> for SdkError {
    fn from(e: reqwest::Error) -> Self {
        SdkError::Http(e.to_string())
    }
}

impl From<serde_json::Error> for SdkError {
    fn from(e: serde_json::Error) -> Self {
        SdkError::Json(e.to_string())
    }
}
