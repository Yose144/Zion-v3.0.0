//! # ZION Issobella — V3 L6 Space Layer
//!
//! > *"The star is not the destination — it is the beginning."*
//!
//! ## Architecture
//!
//! ```text
//!                 ┌──────────────────────────────────────┐
//!                 │      ZION ISSOBELLA (L6)            │
//!                 │                                      │
//!                 │  ┌────────────┐  ┌──────────────┐  │
//!                 │  │  Missions  │  │  Observatory │  │
//!                 │  │  Registry  │  │   Data       │  │
//!                 │  └─────┬──────┘  └──────┬───────┘  │
//!                 │  ┌─────┴──────┐  ┌─────┴──────┐   │
//!                 │  │  Research  │  │  Satellite │   │
//!                 │  │ Proposals  │  │  Mesh Net  │   │
//!                 │  └─────┬──────┘  └─────┬──────┘   │
//!                 │  ┌─────┴─────────────┴──────┐   │
//!                 │  │     Fund Balance          │   │
//!                 │  │     (L1 scanner)          │   │
//!                 └──┴──────────────────────────┘   │
//!                                    │
//!                 ┌─────────────────┴──────────────────┐
//!                 │  L1 BLOCKCHAIN (READ ONLY)          │
//!                 │  5% block reward → Issobella Fund │
//!                 └─────────────────────────────────────┘
//! ```
//!
//! ## ⚠️ Layer Boundary
//!
//! This is a **V3 L6 crate**. It MUST NOT modify L1 state directly.
//! Communication with L1 is through:
//! - L1 RPC polling for block rewards
//! - Read-only queries to track Issobella fund accumulation
//! - L2 DAO for governance proposals on mission funding

pub mod api;
pub mod config;
pub mod dao_client;
pub mod db;
pub mod error;
pub mod hiran_bridge;
pub mod l1_scanner;
pub mod metrics;

// Re-exports
pub use config::IssobellaConfig;
pub use db::{FundBalance, IssobellaDb, MissionRecord, ResearchProposal};
pub use error::{IssobellaError, IssobellaResult};
pub use l1_scanner::{L1Scanner, ScannerConfig};
