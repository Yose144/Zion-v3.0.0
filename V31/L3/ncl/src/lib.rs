//! # ZION NCL — Neural Compute Layer (V3 Mainnet)
//!
//! Decentralized AI task marketplace where miners provide GPU/NPU compute
//! and earn ZION rewards for executing AI inference jobs.
//!
//! ## V3 Decimal Convention (post-3.0.3 fork)
//!
//! All ZION amounts use **6-decimal flowers** (1 ZION = 10^6 flowers).
//! Fields named `reward_flowers`, `total_earned`, etc. are in flowers.
//!
//! ## Architecture
//! ```text
//! ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
//! │   Job Queue   │───│  Scheduler   │───│   Workers    │
//! │  (SQLite)     │   │  (Tokio)     │   │  (backends)  │
//! └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
//!        │                   │                   │
//!   ┌────┴────┐        ┌────┴────┐        ┌────┴─────┐
//!   │  API    │        │ Pricing │        │ Backends │
//!   │ (Axum) │        │ Engine  │        │ONNX|WASM │
//!   └─────────┘        └─────────┘        │TF|Custom│
//!                                         └──────────┘
//! ```

pub mod api;
pub mod backend;
pub mod error;
pub mod pricing;
pub mod reputation;
pub mod scheduler;
pub mod store;
pub mod types;

pub use api::{create_router, NclAppState};
pub use error::{NclError, NclResult};
pub use pricing::PricingEngine;
pub use reputation::{ReputationRecord, ReputationRegistry};
pub use scheduler::JobScheduler;
pub use store::JobStore;
pub use types::{ComputeBackend, NclJob, NclJobStatus, NclTaskType, NclWorker};

/// Build provenance marker (8.S2). One contiguous literal on purpose: ops
/// tooling reads it from the binary with `grep -ao 'zion-build-id:[^[:space:]]*'`
/// instead of running the daemon or trusting mtime. Value comes from build.rs.
#[used]
#[allow(dead_code)]
static ZION_BUILD_ID_MARKER: &str = concat!("zion-build-id:", env!("ZION_BUILD_ID"));
