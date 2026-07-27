//! EVM adapter — uses `ethers` HTTP provider.
//!
//! Current scope (Mainnet Alpha scaffold):
//! - read chain height,
//! - read native balance,
//! - read tx confirmations.
//!
//! Transaction signing is intentionally left for the next iteration, where the
//! adapter will receive a `LocalWallet` derived from the `Keyring`.

use async_trait::async_trait;
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address as EthAddress, H256};
use std::str::FromStr;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};

/// EVM adapter configured for a specific RPC and chain.
pub struct EvmAdapter {
    name: String,
    chain: ChainId,
    provider: Provider<Http>,
}

impl EvmAdapter {
    pub fn new(name: impl Into<String>, chain: ChainId, rpc_url: &str) -> MultichainResult<Self> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| MultichainError::Config(format!("invalid EVM RPC {rpc_url}: {e}")))?;

        Ok(Self {
            name: name.into(),
            chain,
            provider,
        })
    }

    fn to_eth_address(&self, addr: &Address) -> MultichainResult<EthAddress> {
        if addr.chain != self.chain && addr.chain.family() != ChainFamily::Evm {
            return Err(MultichainError::Validation(format!(
                "expected {} EVM address, got {}",
                self.name,
                addr.chain.as_str()
            )));
        }
        EthAddress::from_str(&addr.encoded)
            .map_err(|e| MultichainError::Validation(format!("invalid EVM address: {e}")))
    }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    fn name(&self) -> &str {
        &self.name
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Evm
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        match self.provider.get_block_number().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        // Event watching needs a contract address + filter.
        // Returning empty is intentional for the scaffold stage.
        Ok(vec![])
    }

    async fn execute_outbound(&self, _transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "EVM outbound signing not yet implemented in Mainnet Alpha scaffold".to_string(),
        ))
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        let block = self
            .provider
            .get_block_number()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        Ok(block.as_u64())
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        let h256 = H256::from_slice(tx_hash.as_bytes());
        let receipt = self
            .provider
            .get_transaction_receipt(h256)
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        let receipt = match receipt {
            Some(r) => r,
            None => return Ok(0),
        };

        let tx_block = receipt
            .block_number
            .ok_or_else(|| MultichainError::Internal("receipt missing block_number".to_string()))?
            .as_u64();
        let tip = self.current_height().await?;
        Ok(tip.saturating_sub(tx_block) + 1)
    }

    async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "EVM send_payment requires a signer; not wired yet".to_string(),
        ))
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let eth_addr = self.to_eth_address(address)?;
        let wei = self
            .provider
            .get_balance(eth_addr, None)
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        // EVM balances are U256; ZION Amount is u128. Mainnet ETH/ERC-20 totals
        // never exceed u128 in practice, so this cast is safe for Mainnet Alpha.
        Ok(Amount::new(wei.as_u128()))
    }
}
