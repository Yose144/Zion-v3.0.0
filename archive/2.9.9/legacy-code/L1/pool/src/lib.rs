// Suppress style lints for pool protocol code
#![allow(
    clippy::too_many_arguments,      // Stratum protocol handlers require many params
    clippy::should_implement_trait,  // Algorithm::from_str is not std::str::FromStr
    clippy::new_without_default,     // SessionManager is not default-constructible
)]

pub mod blockchain;
pub mod config;
pub mod jobs;
pub mod metrics;
pub mod payout;
pub mod pplns;
pub mod session;
pub mod shares;
pub mod stratum;
pub mod vardiff;

// CH v3 Revenue Orchestration — L1 Phase 1
pub mod buyback;
pub mod pool_external_miner;
pub mod profit_switcher;
pub mod revenue_proxy;
pub mod stream_scheduler;

// CHv3 Byproduct / Merged mining (safe scaffolding)
pub mod merged_mining;

// Native GPU-algorithm mining: ETC (Ethash) + ERG (Autolykos v2)
// Enabled via --features native-ethash / native-autolykos at build time.
pub mod gpu_mining;

// NOTE: The following modules remain post-mainnet:
// - consciousness (XP/levels → moved to pool-level off-chain or OASIS game)
// - ncl (Neural Consciousness Layer → post-mainnet)
// - algorithms (handled by cosmic-harmony crate)
