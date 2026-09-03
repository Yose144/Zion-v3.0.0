use async_trait::async_trait;
use serde_json::Value;

use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};

use crate::error::{MultichainError, MultichainResult};
use crate::types::Transfer;

/// Mining / PoW block template for pool job generation.
#[derive(Clone, Debug)]
pub struct BlockTemplate {
    pub template_id: u64,
    pub height: u64,
    pub header_hex: String,
    pub target_hex: String,
    pub block_reward: u64,
    /// Raw JSON as returned by the L1 node; used to reconstruct the solved block.
    pub raw: Value,
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

    /// Poll for deposits sent to any of the supplied addresses.
    ///
    /// Default implementation returns an empty vector; adapters should override
    /// this once they can scan for multi-address deposits.
    async fn watch_addresses(&self, _addresses: &[Address]) -> MultichainResult<Vec<DepositEvent>> {
        Ok(Vec::new())
    }

    /// Execute an outbound transfer (mint, release, or refund) on this chain.
    async fn execute_outbound(&self, transfer: &Transfer) -> MultichainResult<Hash>;

    async fn current_height(&self) -> MultichainResult<u64>;

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64>;

    /// Build and sign a raw payment from this adapter's wallet/key.
    async fn send_payment(&self, to: &Address, amount: Amount) -> MultichainResult<Hash>;

    /// Transfer an ERC-20 / token asset.  Default implementation falls back to
    /// a native payment (used by chains without a generic token contract layer).
    async fn transfer_token(
        &self,
        _token: &Asset,
        to: &Address,
        amount: Amount,
    ) -> MultichainResult<Hash> {
        self.send_payment(to, amount).await
    }

    /// Execute an on-chain AMM swap through a pair contract.
    /// Returns (tx_hash, amount_out). Default: not supported.
    async fn amm_swap(
        &self,
        _pair_address: &str,
        _token_in: &Asset,
        _token_out: &Asset,
        _amount_in: Amount,
        _recipient: &Address,
    ) -> MultichainResult<(Hash, Amount)> {
        Err(MultichainError::Unsupported(
            "amm_swap not supported on this chain".to_string(),
        ))
    }

    /// Execute an on-chain AMM swap through a Router contract (multi-hop).
    /// Returns (tx_hash, amount_out). Default: not supported.
    async fn amm_router_swap(
        &self,
        _router_address: &str,
        _path: &[Asset],
        _amount_in: Amount,
        _amount_out_min: Amount,
        _recipient: &Address,
        _deadline: u64,
    ) -> MultichainResult<(Hash, Amount)> {
        Err(MultichainError::Unsupported(
            "amm_router_swap not supported on this chain".to_string(),
        ))
    }

    /// Add liquidity to an on-chain AMM pair via a Router contract.
    /// Returns (tx_hash, amount_a, amount_b, lp_tokens). Default: not supported.
    async fn amm_add_liquidity(
        &self,
        _router_address: &str,
        _token_a: &Asset,
        _token_b: &Asset,
        _amount_a_desired: Amount,
        _amount_b_desired: Amount,
        _amount_a_min: Amount,
        _amount_b_min: Amount,
        _recipient: &Address,
        _deadline: u64,
    ) -> MultichainResult<(Hash, Amount, Amount, Amount)> {
        Err(MultichainError::Unsupported(
            "amm_add_liquidity not supported on this chain".to_string(),
        ))
    }

    /// Remove liquidity from an on-chain AMM pair via a Router contract.
    /// Returns (tx_hash, amount_a, amount_b). Default: not supported.
    async fn amm_remove_liquidity(
        &self,
        _router_address: &str,
        _token_a: &Asset,
        _token_b: &Asset,
        _liquidity: Amount,
        _amount_a_min: Amount,
        _amount_b_min: Amount,
        _recipient: &Address,
        _deadline: u64,
    ) -> MultichainResult<(Hash, Amount, Amount)> {
        Err(MultichainError::Unsupported(
            "amm_remove_liquidity not supported on this chain".to_string(),
        ))
    }

    /// Get the pair address for two tokens from a Factory contract.
    /// Default: not supported.
    async fn amm_get_pair(
        &self,
        _factory_address: &str,
        _token_a: &Asset,
        _token_b: &Asset,
    ) -> MultichainResult<Option<String>> {
        Err(MultichainError::Unsupported(
            "amm_get_pair not supported on this chain".to_string(),
        ))
    }

    /// Quote a swap through a Uniswap V3–compatible DEX (QuoterV2).
    /// Returns the expected output amount for a single-hop swap.
    /// `fee` is the pool fee in hundredths of a bip (e.g. 3000 = 0.3%, 10000 = 1%).
    async fn v3_quote(
        &self,
        _quoter_address: &str,
        _token_in: &Asset,
        _token_out: &Asset,
        _amount_in: Amount,
        _fee: u32,
    ) -> MultichainResult<Amount> {
        Err(MultichainError::Unsupported(
            "v3_quote not supported on this chain".to_string(),
        ))
    }

    /// Execute a swap through a Uniswap V3–compatible DEX (SwapRouter02).
    /// Returns (tx_hash, amount_out).
    /// `fee` is the pool fee in hundredths of a bip (e.g. 3000 = 0.3%, 10000 = 1%).
    async fn v3_swap(
        &self,
        _router_address: &str,
        _token_in: &Asset,
        _token_out: &Asset,
        _amount_in: Amount,
        _amount_out_min: Amount,
        _recipient: &Address,
        _fee: u32,
        _deadline: u64,
    ) -> MultichainResult<(Hash, Amount)> {
        Err(MultichainError::Unsupported(
            "v3_swap not supported on this chain".to_string(),
        ))
    }

    /// Query the spendable balance for `address` of the native asset.
    async fn balance(&self, address: &Address) -> MultichainResult<Amount>;

    /// Query the balance of a specific token (ERC-20 / analogous) for `address`.
    /// For native assets (no contract), this falls back to `balance()`.
    async fn token_balance(
        &self,
        asset: &Asset,
        address: &Address,
    ) -> MultichainResult<Amount> {
        if asset.id.contract.is_none() {
            return self.balance(address).await;
        }
        let _ = address;
        Err(MultichainError::Unsupported(format!(
            "token_balance not supported for {} on {}",
            asset.id,
            self.name()
        )))
    }

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
    pub asset: Option<Asset>,
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
