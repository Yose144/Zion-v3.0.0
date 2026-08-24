//! ZIS-backed custodial multichain wallet.
//!
//! - Per-user deposit address derivation.
//! - Internal ledger (credit / debit / balance).
//! - Deposit watcher and withdrawal processor.

pub mod deposits;
pub mod derivation;
pub mod ledger;
pub mod types;
pub mod withdrawals;

pub use deposits::DepositWatcher;
pub use derivation::MultichainWallet;
pub use ledger::{asset_key, WalletLedger};
pub use types::*;
pub use withdrawals::WithdrawalProcessor;
