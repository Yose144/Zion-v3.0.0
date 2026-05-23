// Suppress low-risk style lints in core consensus code
#![allow(
    clippy::unnecessary_cast,       // u64 as u64 for clarity in mixed-width arithmetic
    clippy::manual_div_ceil,        // explicit division patterns
    clippy::while_let_on_iterator,  // explicit loop patterns
    clippy::needless_borrow,        // &x where x: &T
    clippy::manual_is_multiple_of,  // x % n == 0 patterns
    clippy::new_without_default,    // not all types benefit from Default
    clippy::manual_range_contains,  // explicit comparisons
)]

pub mod algorithms;
pub mod blockchain;
pub mod crypto;
pub mod jsonrpc;
pub mod load_test;
pub mod load_test_v2;
pub mod mempool;
pub mod metrics;
pub mod miner;
pub mod network;
pub mod p2p;
pub mod rpc;
pub mod security_audit;
pub mod state;
pub mod storage;
pub mod tx;
pub mod wallet;
pub use blockchain::premine;
