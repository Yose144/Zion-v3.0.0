//! **Zion SDK** — async knihovna pro práci se ZION L1 node přes TCP JSON-RPC (jeden JSON objekt na řádek, výchozí port **8443**).
//!
//! ## Základní použití
//!
//! ```no_run
//! use zion_sdk::node::NodeClient;
//!
//! # async fn demo() -> zion_sdk::Result<()> {
//! let client = NodeClient::builder("127.0.0.1", 8443)
//!     .connect_timeout(std::time::Duration::from_secs(5))
//!     .request_timeout(std::time::Duration::from_secs(30))
//!     .build();
//!
//! let chain = client.chain_info().await?;
//! println!("height={}", chain.chain_height);
//! # Ok(())
//! # }
//! ```
//!
//! Chování je zarovnané se `zion-cli` (`V3/cli`): stejný wire protokol a stejné názvy metod (`getChainInfo`, …).
//!
//! ## Produkční konfigurace
//!
//! [`NodeClient::from_env`] / [`NodeClientBuilder::from_env`] načtou [`NodeClientConfig`] z proměnných `ZION_RPC_*` (viz [`config`]).
//!
//! Volitelně zapněte feature **`tracing`** pro strukturované logy RPC (retry, úspěch).

pub mod config;
pub mod error;
pub mod node;
pub mod rpc_codes;
pub mod types;

/// Verze crate (`CARGO_PKG_VERSION`).
pub const SDK_VERSION: &str = env!("CARGO_PKG_VERSION");

pub use config::{parse_rpc_addr, NodeClientConfig};
pub use error::{Result, RpcErrorBody, ZionSdkError};
pub use node::{NodeClient, NodeClientBuilder};
pub use types::{
    ChainInfo, MempoolInfo, NodeInfo, PeerEndpoint, PeerInfo, SubmitAccepted, SubmitBlockParams,
    SubmitCandidateResult, SupplyInfo,
};

/// Běžné importy pro aplikační kód.
pub mod prelude {
    pub use crate::config::{parse_rpc_addr, NodeClientConfig};
    pub use crate::error::{Result, RpcErrorBody, ZionSdkError};
    pub use crate::node::{NodeClient, NodeClientBuilder};
    pub use crate::types::{
        ChainInfo, MempoolInfo, NodeInfo, PeerEndpoint, PeerInfo, SubmitAccepted, SubmitBlockParams,
        SubmitCandidateResult, SupplyInfo,
    };
}
