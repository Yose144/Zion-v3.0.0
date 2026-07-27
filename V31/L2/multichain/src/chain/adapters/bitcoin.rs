//! Bitcoin adapter — mempool.space REST API.
//!
//! Current scope (Mainnet Alpha scaffold):
//! - read chain height,
//! - read confirmed + unconfirmed UTXO balance,
//! - tx confirmations.
//!
//! Sending (P2WPKH build + sign) and deposit watching are deferred to the next
//! iteration, where the adapter will receive a `BitcoinSigner` from the keyring.

use async_trait::async_trait;
use bitcoin::hashes::Hash as _;
use serde::Deserialize;
use std::str::FromStr;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};

const MAINNET_API: &str = "https://mempool.space/api";
const TESTNET_API: &str = "https://mempool.space/testnet/api";
const SIGNET_API: &str = "https://mempool.space/signet/api";

/// Network name as accepted by `bitcoin::Network::from_core_arg`.
#[derive(Clone, Debug)]
pub struct BitcoinAdapter {
    network: bitcoin::Network,
    api_url: String,
    client: reqwest::Client,
}

impl BitcoinAdapter {
    pub fn new(network_str: &str) -> MultichainResult<Self> {
        let network = bitcoin::Network::from_core_arg(network_str)
            .map_err(|_| MultichainError::Config(format!("unknown bitcoin network: {network_str}")))?;

        let api_url = match network {
            bitcoin::Network::Bitcoin => MAINNET_API,
            bitcoin::Network::Testnet => TESTNET_API,
            bitcoin::Network::Signet => SIGNET_API,
            _ => MAINNET_API,
        }
        .to_string();

        Ok(Self {
            network,
            api_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .map_err(|e| MultichainError::Internal(e.to_string()))?,
        })
    }

    fn validate_address(&self, addr: &Address) -> MultichainResult<bitcoin::Address<bitcoin::address::NetworkChecked>> {
        if addr.chain != ChainId::Bitcoin {
            return Err(MultichainError::Validation(format!(
                "expected bitcoin address, got {}",
                addr.chain.as_str()
            )));
        }
        let unchecked = bitcoin::Address::from_str(&addr.encoded)
            .map_err(|e| MultichainError::Validation(e.to_string()))?;
        unchecked
            .require_network(self.network)
            .map_err(|e| MultichainError::Validation(e.to_string()))
    }

    fn btc_address_string(&self, addr: &Address) -> MultichainResult<String> {
        let checked = self.validate_address(addr)?;
        Ok(checked.to_string())
    }
}

#[async_trait]
impl ChainAdapter for BitcoinAdapter {
    fn name(&self) -> &str {
        "bitcoin"
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Utxo
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        let url = format!("{}/blocks/tip/height", self.api_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        if !resp.status().is_success() {
            return Ok(false);
        }
        let _height: u64 = resp
            .text()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .parse::<u64>()
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        let _ = _height;
        Ok(true)
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        // Deposit watching requires a configured deposit address + long-poll.
        // Returning empty is intentional for the scaffold stage.
        Ok(vec![])
    }

    async fn execute_outbound(&self, _transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "bitcoin outbound signing not yet implemented in Mainnet Alpha scaffold".to_string(),
        ))
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        let url = format!("{}/blocks/tip/height", self.api_url);
        let text = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .text()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        text.parse::<u64>()
            .map_err(|e| MultichainError::Internal(e.to_string()))
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        let txid = bitcoin::Txid::from_slice(tx_hash.as_bytes())
            .map_err(|e| MultichainError::Validation(e.to_string()))?;
        let url = format!("{}/api/tx/{}", self.api_url, txid);
        let tx = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json::<MempoolTx>()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        if !tx.status.confirmed {
            return Ok(0);
        }

        let block_height = tx
            .status
            .block_height
            .ok_or_else(|| MultichainError::Internal("confirmed tx missing block_height".to_string()))?;
        let tip = self.current_height().await?;
        Ok(tip.saturating_sub(block_height) + 1)
    }

    async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "bitcoin send_payment requires a signer; not wired yet".to_string(),
        ))
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let addr = self.btc_address_string(address)?;
        let url = format!("{}/api/address/{}/utxo", self.api_url, addr);
        let utxos = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json::<Vec<MempoolUtxo>>()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        let total: u64 = utxos.into_iter().map(|u| u.value).sum();
        Ok(Amount::new(total as u128))
    }
}

#[derive(Debug, Deserialize)]
struct MempoolUtxo {
    value: u64,
}

#[derive(Debug, Deserialize)]
struct MempoolTx {
    status: MempoolTxStatus,
}

#[derive(Debug, Deserialize)]
struct MempoolTxStatus {
    confirmed: bool,
    block_height: Option<u64>,
}
