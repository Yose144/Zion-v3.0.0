//! `zion-sdk` — async client library for ZION V31 nodes, wallet, and multichain.
//!
//! Provides high-level APIs for:
//! - JSON-RPC communication with `zion-node`
//! - Wallet key management via `zion-multichain::Keyring`
//! - Block template retrieval and block submission
//! - Balance queries and transaction building
//!
//! ## Quick start
//!
//! ```no_run
//! use zion_sdk::node::NodeClient;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! let client = NodeClient::new("http://127.0.0.1:9445");
//! let status = client.status().await?;
//! println!("Chain height: {}", status.height);
//! # Ok(())
//! # }
//! ```

pub mod config;
pub mod error;
pub mod node;
pub mod rpc_codes;
pub mod types;
pub mod wallet;

pub use config::SdkConfig;
pub use error::{SdkError, SdkResult};
pub use node::NodeClient;
pub use types::{BlockTemplate, NodeStatus, SubmitBlockResult};
pub use wallet::WalletClient;
