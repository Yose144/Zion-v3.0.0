//! `zion-dao` — L2 governance runtime for ZION Mainnet Alpha.
//!
//! V31 port of V3/L2/dao: proposals, quorum, timelock, voting engine,
//! governance runtime, and HTTP API.

pub mod api;
pub mod co_admin;
pub mod config;
pub mod consent;
pub mod cross_layer;
pub mod db;
pub mod error;
pub mod executor;
pub mod humanitarian;
pub mod l1_scanner;
pub mod metrics;
pub mod prizes;
pub mod proposal;
pub mod quorum;
pub mod runtime;
pub mod timelock;
pub mod treasury;
pub mod types;
pub mod voting;

pub use co_admin::CoAdminRegistry;
pub use config::DaoConfig;
pub use consent::{Attestation, ConsentEngine, ConsentRecord};
pub use cross_layer::{CrossLayerRegistry, CrossLayerState, LayerConsent};
pub use db::DaoDb;
pub use error::{DaoError, DaoResult};
pub use executor::execute_proposal;
pub use humanitarian::{HumanitarianCategory, HumanitarianFund};
pub use l1_scanner::{L1Scanner, ScannerConfig};
pub use metrics::DaoMetrics;
pub use prizes::{PendingPrize, PrizeDistributor, PrizeTier};
pub use proposal::{Proposal, ProposalStatus, ProposalType};
pub use quorum::check_quorum;
pub use runtime::GovernanceRuntime;
pub use timelock::Timelock;
pub use treasury::{Treasury, TreasuryOperation};
pub use types::VoteChoice;
pub use voting::{Vote, VotingEngine};
