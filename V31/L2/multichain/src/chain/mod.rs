pub mod adapter;
pub mod adapters;

pub use adapter::{BlockTemplate, ChainAdapter, ChainAdapterRegistry, DepositEvent};
pub use adapters::{BitcoinAdapter, EvmAdapter, ZionL1Adapter};
