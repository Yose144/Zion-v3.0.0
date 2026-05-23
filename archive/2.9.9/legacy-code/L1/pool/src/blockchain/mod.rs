pub mod reward_calculator;
/// Blockchain communication module — Clean L1
/// Handles RPC calls to ZION Core and reward calculations
pub mod rpc_client;
pub mod template_manager;

pub use reward_calculator::RewardCalculator;
pub use rpc_client::ZionRPCClient;
pub use template_manager::{BlockTemplate, BlockTemplateManager};
