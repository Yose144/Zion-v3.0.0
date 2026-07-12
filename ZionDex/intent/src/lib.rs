//! ZionDex Intent-Based Execution core crate.
//!
//! This crate implements the data structures, signing, verification, and
//! auction engine for Phase 4 (Intent-Based Execution) of ZionDex.
//!
//! Users sign off-chain "swap intents" (input token/amount, minimum output,
//! deadline, nonce). Off-chain solvers compete in a short Dutch auction to
//! offer the best guaranteed output. The winning solver then executes the
//! swap on-chain (possibly across chains via the WARP bridge).
//!
//! # Modules
//!
//! - [`types`] — core data structures (`SwapIntent`, `SolverBid`, `PathHop`, ...)
//! - [`signing`] — EIP-712 (EVM) and Ed25519 (Solana) intent signing/verification
//! - [`auction`] — Dutch auction engine that collects bids and settles
//! - [`solver`] — `Solver` trait and a `SimpleSolver` that uses the Router API
//! - [`errors`] — crate-wide error types

pub mod auction;
pub mod errors;
pub mod signing;
pub mod solver;
pub mod types;

pub use auction::{Auction, AuctionEngine};
pub use errors::{Error, Result};
pub use signing::{sign_intent_evm, sign_intent_solana, verify_intent_evm, verify_intent_solana};
pub use solver::{ExecutionResult, SimpleSolver, Solver};
pub use types::{ChainId, IntentStatus, PathHop, SolverBid, SwapIntent};
