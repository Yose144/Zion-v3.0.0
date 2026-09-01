pub mod adapter;
pub mod adapters;
pub mod unified_registry;

pub use adapter::{BlockTemplate, ChainAdapter, ChainAdapterRegistry, DepositEvent};
pub use adapters::{BitcoinAdapter, EvmAdapter, ZionL1Adapter};
pub use unified_registry::UnifiedAdapterRegistry;
