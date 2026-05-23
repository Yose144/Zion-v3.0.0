//! # 🧠 ZION NCL — Neural Compute Layer
//!
//! Decentralized AI task marketplace where miners provide GPU/NPU compute
//! and earn ZION rewards for executing AI inference jobs.
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
pub use store::JobStore;
pub use scheduler::JobScheduler;
pub use types::{ComputeBackend, NclJob, NclJobStatus, NclTaskType, NclWorker};
