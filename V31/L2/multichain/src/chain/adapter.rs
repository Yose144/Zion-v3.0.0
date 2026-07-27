use async_trait::async_trait;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::error::MultichainResult;
use crate::types::Transfer;

/// Mining / PoW block template for pool job generation.
#[derive(Clone, Debug)]
pub struct BlockTemplate {
    pub template_id: u64,
    pub height: u64,
    pub header_hex: String,
    pub target_hex: String,
}

/// Abstract interface every supported chain must implement.
///
/// This is the single integration point for bridges, swaps, DEX, and wallets.
/// Concrete adapters live in `src/chain/adapters/` (Bitcoin, EVM, Solana, ...).
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    fn name(&self) -> &str;

    fn family(&self) -> ChainFamily;

    async fn health_check(&self) -> MultichainResult<bool>;

    /// Poll for deposit or burn events on this chain.
    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>>;

    /// Execute an outbound transfer (mint, release, or refund) on this chain.
    async fn execute_outbound(&self, transfer: &Transfer) -> MultichainResult<Hash>;

    async fn current_height(&self) -> MultichainResult<u64>;

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64>;

    /// Build and sign a raw payment from this adapter's wallet/key.
    async fn send_payment(&self, to: &Address, amount: Amount) -> MultichainResult<Hash>;

    /// Query the spendable balance for `address` of the native asset.
    async fn balance(&self, address: &Address) -> MultichainResult<Amount>;

    /// Return a mining block template, if this chain supports PoW job generation.
    async fn block_template(&self) -> MultichainResult<Option<BlockTemplate>> {
        Ok(None)
    }
}

/// Event observed on a chain that can advance a `Transfer`.
#[derive(Clone, Debug)]
pub struct DepositEvent {
    pub chain: ChainId,
    pub tx_hash: Hash,
    pub recipient: Address,
    pub amount: Amount,
    pub memo: Option<String>,
    pub confirmations: u64,
}

/// Registry of adapters keyed by `ChainId`.
#[derive(Default)]
pub struct ChainAdapterRegistry {
    adapters: std::collections::HashMap<ChainId, Box<dyn ChainAdapter>>,
}

impl ChainAdapterRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, chain: ChainId, adapter: Box<dyn ChainAdapter>) {
        self.adapters.insert(chain, adapter);
    }

    pub fn get(&self, chain: ChainId) -> Option<&dyn ChainAdapter> {
        self.adapters.get(&chain).map(|b| b.as_ref())
    }

    pub fn chains(&self) -> Vec<ChainId> {
        self.adapters.keys().copied().collect()
    }
}
