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

pub mod error;
pub mod types;
pub mod scheduler;
pub mod pricing;
pub mod backend;

pub use error::{NclError, NclResult};
pub use types::{NclJob, NclJobStatus, NclWorker, ComputeBackend};
pub use scheduler::JobScheduler;
pub use pricing::PricingEngine;
