//! ZION stratum pool — PPLNS share accounting and AuxPoW validation.

pub mod api;
pub mod auxpow_bridge;
pub mod auxpow_runtime;
pub mod block_tracker;
pub mod config;
pub mod notifications;
pub mod payout;
pub mod pool;
pub mod pplns;
pub mod profit_switcher;
pub mod rate_limit;
pub mod revenue_proxy;
pub mod revenue_scheduler;
pub mod rpc_client;
pub mod share;
pub mod share_forwarder;
pub mod share_relay;
pub mod store;
pub mod stratum;
pub mod stratum_v1;
pub mod telemetry;
pub mod template_cache;
pub mod tls;
pub mod validator;
pub mod v3_pplns;
pub mod v3_protocol;
pub mod vardiff;

pub use config::{PoolConfig, RateLimitConfig};
pub use pool::{Pool, PoolError};
pub use pplns::{Payout, PplnsState, ShareRecord};
pub use share::{Share, ShareSubmission};
pub use stratum::StratumServer;
pub use validator::ShareValidator;
