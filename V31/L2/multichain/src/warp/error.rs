use thiserror::Error;

/// All error types for the WARP subsystem.
#[derive(Error, Debug, Clone)]
pub enum WarpError {
    // ── Chain errors ──────────────────────────────────────────────
    #[error("Unsupported chain: {0}")]
    UnsupportedChain(String),

    #[error("Chain {chain} is currently disabled")]
    ChainDisabled { chain: String },

    #[error("Chain adapter error ({chain}): {reason}")]
    AdapterError { chain: String, reason: String },

    #[error("Chain adapter not yet implemented: {0}")]
    AdapterNotImplemented(String),

    #[error("Finality not reached for chain {chain}: {confirmations}/{required}")]
    FinalityNotReached {
        chain: String,
        confirmations: u64,
        required: u64,
    },

    // ── Transfer errors ───────────────────────────────────────────
    #[error("Transfer not found: {0}")]
    TransferNotFound(String),

    #[error("Invalid transfer state transition: {from} → {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("Transfer amount below minimum: {amount} < {minimum}")]
    AmountBelowMinimum { amount: u64, minimum: u64 },

    #[error("Transfer amount exceeds daily limit: {amount} > {limit}")]
    DailyLimitExceeded { amount: u64, limit: u64 },

    #[error("Transfer exceeds timelock threshold: {amount} > {threshold}")]
    TimelockRequired { amount: u64, threshold: u64 },

    // ── Validation errors ─────────────────────────────────────────
    #[error("Invalid memo format: {0}")]
    InvalidMemo(String),

    #[error("Invalid destination address for {chain}: {address}")]
    InvalidAddress { chain: String, address: String },

    #[error("Decimal conversion overflow: {from_decimals} → {to_decimals}")]
    DecimalOverflow { from_decimals: u8, to_decimals: u8 },

    #[error("Quorum not reached: {signatures}/{required}")]
    QuorumNotReached { signatures: usize, required: usize },

    #[error("Invalid validator signature from {validator}")]
    InvalidSignature { validator: String },

    #[error("Duplicate transfer: {tx_hash}")]
    DuplicateTransfer { tx_hash: String },

    // ── Infrastructure ────────────────────────────────────────────
    #[error("Database error: {0}")]
    Database(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Emergency pause active for chain: {0}")]
    EmergencyPause(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type WarpResult<T> = Result<T, WarpError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display_unsupported_chain() {
        let e = WarpError::UnsupportedChain("fantom".into());
        assert!(e.to_string().contains("fantom"));
    }

    #[test]
    fn test_error_display_finality() {
        let e = WarpError::FinalityNotReached {
            chain: "bitcoin".into(),
            confirmations: 3,
            required: 6,
        };
        assert!(e.to_string().contains("3/6"));
    }

    #[test]
    fn test_error_display_quorum() {
        let e = WarpError::QuorumNotReached {
            signatures: 2,
            required: 3,
        };
        assert!(e.to_string().contains("2/3"));
    }

    #[test]
    fn test_error_display_amount_below_min() {
        let e = WarpError::AmountBelowMinimum {
            amount: 50,
            minimum: 100,
        };
        assert!(e.to_string().contains("50"));
        assert!(e.to_string().contains("100"));
    }

    #[test]
    fn test_error_display_daily_limit() {
        let e = WarpError::DailyLimitExceeded {
            amount: 15_000_000,
            limit: 10_000_000,
        };
        assert!(e.to_string().contains("15000000"));
    }

    #[test]
    fn test_error_display_invalid_memo() {
        let e = WarpError::InvalidMemo("missing chain id".into());
        assert!(e.to_string().contains("missing chain id"));
    }

    #[test]
    fn test_error_display_duplicate() {
        let e = WarpError::DuplicateTransfer {
            tx_hash: "abc123".into(),
        };
        assert!(e.to_string().contains("abc123"));
    }

    #[test]
    fn test_error_display_emergency() {
        let e = WarpError::EmergencyPause("solana".into());
        assert!(e.to_string().contains("solana"));
    }

    #[test]
    #[allow(clippy::unnecessary_literal_unwrap)]
    fn test_warp_result_ok() {
        let r: WarpResult<u64> = Ok(42);
        assert_eq!(r.unwrap(), 42);
    }

    #[test]
    fn test_warp_result_err() {
        let r: WarpResult<u64> = Err(WarpError::UnsupportedChain("test".into()));
        assert!(r.is_err());
    }
}
