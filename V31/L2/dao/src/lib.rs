//! `zion-dao` — L2 governance runtime for ZION Mainnet Alpha.
//!
//! V31 port of V3/L2/dao: proposals, quorum, timelock, voting engine,
//! governance runtime, and HTTP API.

pub mod api;
pub mod config;
pub mod db;
pub mod error;
pub mod humanitarian;
pub mod l1_scanner;
pub mod metrics;
pub mod proposal;
pub mod quorum;
pub mod runtime;
pub mod timelock;
pub mod treasury;
pub mod types;
pub mod voting;

pub use config::DaoConfig;
pub use db::DaoDb;
pub use error::{DaoError, DaoResult};
pub use humanitarian::{HumanitarianCategory, HumanitarianFund};
pub use l1_scanner::{L1Scanner, ScannerConfig};
pub use metrics::DaoMetrics;
pub use proposal::{Proposal, ProposalStatus, ProposalType};
pub use quorum::check_quorum;
pub use runtime::GovernanceRuntime;
pub use timelock::Timelock;
pub use treasury::{Treasury, TreasuryOperation};
pub use types::VoteChoice;
pub use voting::{Vote, VotingEngine};
