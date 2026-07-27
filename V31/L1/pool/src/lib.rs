//! ZION stratum pool — PPLNS share accounting and AuxPoW validation.

pub mod config;
pub mod pool;
pub mod pplns;
pub mod share;
pub mod stratum;
pub mod validator;

pub use config::PoolConfig;
pub use pool::{Pool, PoolError};
pub use pplns::{Payout, PplnsState, ShareRecord};
pub use share::{Share, ShareSubmission};
pub use stratum::StratumServer;
pub use validator::ShareValidator;
