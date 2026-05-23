pub mod processor;
pub mod storage;
/// Mining shares module
///
/// Handles share validation, duplicate detection, and persistence
/// Mirrors Python src/pool/mining/share_validator.py implementation
pub mod validator;

pub use processor::{ProcessedShareOutcome, ShareProcessor};
pub use storage::{BlockFound, MinerStats, RedisStorage, StoredShare};
pub use validator::{Algorithm, ShareResult, ShareValidator, SubmittedShare};

#[cfg(test)]
mod tests {}
