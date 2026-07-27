use thiserror::Error;

/// Unified error type for `zion-l1-types`.
#[derive(Debug, Error, PartialEq)]
pub enum L1Error {
    #[error("hex decode error: {0}")]
    HexDecode(#[from] hex::FromHexError),

    #[error("unknown chain id: {0}")]
    UnknownChain(String),

    #[error("invalid address length for {family}: got {got}, expected one of {expected:?}")]
    InvalidAddressLength {
        family: String,
        got: usize,
        expected: Vec<usize>,
    },

    #[error("invalid amount: {0}")]
    InvalidAmount(String),
}

pub type L1Result<T> = Result<T, L1Error>;
