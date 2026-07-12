//! ZionDex Solver Daemon — library surface.
//!
//! Exposes the daemon's modules so that integration tests (and future
//! embedders) can exercise them without going through the binary entry point.

pub mod api;
pub mod config;
pub mod errors;
pub mod node;
pub mod router_client;
pub mod strategy;
pub mod types;
