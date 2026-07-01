use crate::adapter::ChainAdapter;
use crate::cardano_signer::CardanoSigner;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use serde::Deserialize;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// ZION Cardano Native Token (policy_id + asset_name hex)
// ─────────────────────────────────────────────────────────────────────────────
fn zion_asset(network: &str) -> Option<&'static str> {
    match network {
        "mainnet" => {
            warn!("[WARP][cardano] mainnet ZION asset is a placeholder — update with real policy_id+asset_name after deployment");
            Some("5a71011c726573745a494f4e")
        }
        "preprod" => {
            warn!("[WARP][cardano] preprod ZION asset is a placeholder");
            Some("5a71011c726573745a494f4e74")
        }
        _ => None,
    }
}

fn default_blockfrost(network: &str) -> &'static str {
    match network {
        "preprod" => "https://cardano-preprod.blockfrost.io/api/v0",
        "testnet" => "https://cardano-testnet.blockfrost.io/api/v0",
        _ => "https://cardano-mainnet.blockfrost.io/api/v0",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blockfrost REST structures
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
#[allow(dead_code)]
struct BFBlock {
    height: Option<u64>,
    hash: Option<String>,
    slot: Option<u64>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct BFAssetTx {
    tx_hash: String,
    block_height: Option<u64>,
    block_time: Option<u64>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct BFTxDetails {
    hash: Option<String>,
    block: Option<String>,
    block_height: Option<u64>,
    index: Option<u64>,
}

#[derive(Deserialize)]
struct BFTxUtxos {
    inputs: Option<Vec<BFUtxo>>,
    outputs: Option<Vec<BFUtxo>>,
}

#[derive(Deserialize)]
struct BFUtxo {
    address: Option<String>,
    amount: Option<Vec<BFAmount>>,
}

#[derive(Deserialize)]
struct BFAmount {
    unit: String,
    quantity: String,
}

#[derive(Deserialize)]
struct BFTxMetadata {
    label: String,
    json_metadata: Option<serde_json::Value>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Cardano adapter — Native Token watch via Blockfrost REST API.
/// Metadata label 674 carries the WARP_INBOUND destination address.
pub struct CardanoAdapter {
    network: String,
    api_url: String,
    project_id: Option<String>,
    client: reqwest::Client,
}

impl Default for CardanoAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CardanoAdapter {
    pub fn new() -> Self {
        let network = std::env::var("CARDANO_NETWORK").unwrap_or_else(|_| "mainnet".into());
        let api_url = std::env::var("WARP_BLOCKFROST_URL")
            .unwrap_or_else(|_| default_blockfrost(&network).to_string());
        let project_id = std::env::var("BLOCKFROST_PROJECT_ID").ok();

        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(ref pid) = project_id {
            headers.insert(
                "project_id",
                reqwest::header::HeaderValue::from_str(pid).unwrap(),
            );
        }
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .default_headers(headers)
            .build()
            .unwrap();

        Self {
            network,
            api_url,
            project_id,
            client,
        }
    }

    async fn get_latest_block(&self) -> WarpResult<BFBlock> {
        let url = format!("{}/blocks/latest", self.api_url);
        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })
    }

    async fn get_asset_txs(&self, asset: &str) -> WarpResult<Vec<BFAssetTx>> {
        let url = format!(
            "{}/assets/{}/transactions?order=desc&count=50",
            self.api_url, asset
        );
        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })
    }

    async fn get_tx_metadata(&self, tx_hash: &str) -> WarpResult<Vec<BFTxMetadata>> {
        let url = format!("{}/txs/{}/metadata", self.api_url, tx_hash);
        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })
    }

    async fn get_tx_utxos(&self, tx_hash: &str) -> WarpResult<BFTxUtxos> {
        let url = format!("{}/txs/{}/utxos", self.api_url, tx_hash);
        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })
    }

    async fn build_proof_from_tx(
        &self,
        asset: &str,
        asset_tx: &BFAssetTx,
        tip: u64,
    ) -> Option<DepositProof> {
        // Get tx metadata — look for label 674
        let metadata = self.get_tx_metadata(&asset_tx.tx_hash).await.ok()?;
        let dest = metadata
            .iter()
            .find(|m| m.label == "674")
            .and_then(|m| m.json_metadata.as_ref())
            .and_then(|j| j["warp_dest"].as_str())
            .map(|s| s.to_string())?;

        // Get UTXOs to determine amount of ZION burned/locked
        let utxos = self.get_tx_utxos(&asset_tx.tx_hash).await.ok()?;
        let inputs = utxos.inputs.as_deref().unwrap_or_default();
        let outputs = utxos.outputs.as_deref().unwrap_or_default();

        // Amount = sum of ZION in inputs - sum in outputs (burned quantity)
        let sum_in: u64 = inputs
            .iter()
            .flat_map(|u| u.amount.as_deref().unwrap_or_default())
            .filter(|a| a.unit == asset)
            .filter_map(|a| a.quantity.parse::<u64>().ok())
            .sum();
        let sum_out: u64 = outputs
            .iter()
            .flat_map(|u| u.amount.as_deref().unwrap_or_default())
            .filter(|a| a.unit == asset)
            .filter_map(|a| a.quantity.parse::<u64>().ok())
            .sum();

        let amount = sum_in.saturating_sub(sum_out);
        if amount == 0 {
            return None;
        }

        let sender = inputs
            .first()
            .and_then(|u| u.address.clone())
            .unwrap_or_default();

        let block_height = asset_tx.block_height.unwrap_or(0);

        Some(DepositProof {
            tx_hash: asset_tx.tx_hash.clone(),
            block_height,
            block_hash: format!("cardano-block-{}", block_height),
            sender,
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:cardano:{}", dest),
            confirmations: tip.saturating_sub(block_height),
        })
    }
}

#[async_trait]
impl ChainAdapter for CardanoAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Cardano
    }
    fn name(&self) -> &str {
        "cardano"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        if self.project_id.is_none() {
            debug!("[WARP][cardano] No BLOCKFROST_PROJECT_ID — health check skipped");
            return Ok(true); // don't fail if no key configured yet
        }
        match self.get_latest_block().await {
            Ok(b) => {
                info!(
                    "[WARP][cardano] Health OK — block #{}",
                    b.height.unwrap_or(0)
                );
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][cardano] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let asset = match zion_asset(&self.network) {
            Some(a) => a,
            None => {
                debug!("[WARP][cardano] No ZION asset configured");
                return Ok(vec![]);
            }
        };
        if self.project_id.is_none() {
            debug!("[WARP][cardano] No BLOCKFROST_PROJECT_ID — skipping");
            return Ok(vec![]);
        }

        let tip = self.get_latest_block().await?.height.unwrap_or(0);
        let asset_txs = self.get_asset_txs(asset).await?;
        debug!(
            "[WARP][cardano] {} asset txs found for {}",
            asset_txs.len(),
            asset
        );

        let mut proofs = Vec::new();
        for tx in &asset_txs {
            if let Some(proof) = self.build_proof_from_tx(asset, tx, tip).await {
                proofs.push(proof);
            }
        }
        info!("[WARP][cardano] {} BridgeBurn proofs found", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let asset = zion_asset(&self.network).ok_or_else(|| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("no ZION asset configured for network '{}'", self.network),
        })?;

        let signer = CardanoSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;

        let amount = instruction.amount_dest_atomic as u64;
        info!(
            "[WARP][cardano] minting {} ZION to {} on {} (asset {})",
            amount, instruction.recipient, self.network, asset
        );

        signer
            .submit_mint_tx(
                &self.client,
                &self.api_url,
                &instruction.recipient,
                asset,
                amount,
            )
            .await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        if self.project_id.is_none() {
            return Ok(0);
        }
        Ok(self.get_latest_block().await?.height.unwrap_or(0))
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        if self.project_id.is_none() {
            return Ok(0);
        }
        let url = format!("{}/txs/{}", self.api_url, tx_hash);
        let tx: BFTxDetails = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: e.to_string(),
            })?;
        let tx_block = tx.block_height.unwrap_or(0);
        let tip = self.get_latest_block().await?.height.unwrap_or(tx_block);
        Ok(tip.saturating_sub(tx_block))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::MintInstruction;

    #[test]
    fn test_cardano_adapter_meta() {
        let a = CardanoAdapter::new();
        assert_eq!(a.family(), ChainFamily::Cardano);
        assert_eq!(a.name(), "cardano");
    }

    #[test]
    fn test_zion_asset_mainnet() {
        assert!(zion_asset("mainnet").is_some());
        assert!(zion_asset("preprod").is_some());
        assert!(zion_asset("unknown").is_none());
    }

    #[tokio::test]
    async fn test_cardano_health_no_key() {
        // Without project_id, health_check returns Ok(true) (skip)
        assert!(CardanoAdapter::new().health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_cardano_watch_events_no_key_returns_empty() {
        // Without project_id, watch_events returns empty vec
        assert!(CardanoAdapter::new()
            .watch_events()
            .await
            .unwrap()
            .is_empty());
    }

    #[tokio::test]
    async fn test_cardano_execute_mint_no_key_is_err() {
        // Without WARP_CARDANO_PAYMENT_KEY, execute_mint should error
        std::env::remove_var("WARP_CARDANO_PAYMENT_KEY");
        std::env::remove_var("WARP_CARDANO_POLICY_KEY");
        let inst = MintInstruction {
            dest_chain: "cardano".into(),
            recipient: "addr1xyz".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(CardanoAdapter::new().execute_mint(&inst).await.is_err());
    }
}
