use thiserror::Error;

/// Unified error type for `zion-multichain`.
#[derive(Debug, Error)]
pub enum MultichainError {
    #[error("invalid configuration: {0}")]
    Config(String),

    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("chain adapter not found: {0}")]
    AdapterNotFound(String),

    #[error("transfer not found: {0}")]
    TransferNotFound(String),

    #[error("unsupported operation: {0}")]
    Unsupported(String),

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("internal error: {0}")]
    Internal(String),

    #[error("L1 type error: {0}")]
    L1Types(#[from] zion_l1_types::L1Error),
}

pub type MultichainResult<T> = Result<T, MultichainError>;
