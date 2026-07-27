//! Shared ZION primitives used by L1, L2, and CLI in the V31 workspace.
//!
//! This crate is intentionally minimal: it defines identity, value, and chain
//! abstractions. Concrete signing, RPC, and validation logic lives in the
//! consuming crates (e.g. `zion-multichain`).

pub mod address;
pub mod amount;
pub mod asset;
pub mod chain;
pub mod error;
pub mod hash;

pub use address::Address;
pub use amount::Amount;
pub use asset::{Asset, AssetId};
pub use chain::{ChainFamily, ChainId};
pub use error::{L1Error, L1Result};
pub use hash::Hash;
