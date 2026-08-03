//! ZION stratum pool — PPLNS share accounting and AuxPoW validation.

pub mod config;
pub mod pool;
pub mod pplns;
pub mod rate_limit;
pub mod rpc_client;
pub mod share;
pub mod store;
pub mod stratum;
pub mod stratum_v1;
pub mod validator;
pub mod v3_pplns;

// TODO: revenue_proxy needs V3 CoinProfile fields (ticker, pool_host, pool_port)
//       which differ from V31's CoinProfile. Port after ChainState.
// pub mod revenue_proxy;

pub use config::{PoolConfig, RateLimitConfig};
pub use pool::{Pool, PoolError};
pub use pplns::{Payout, PplnsState, ShareRecord};
pub use share::{Share, ShareSubmission};
pub use stratum::StratumServer;
pub use validator::ShareValidator;
