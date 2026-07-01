use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::tron_signer::TronSigner;
use crate::types::ChainFamily;
use async_trait::async_trait;
use serde::Deserialize;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// ZION TRC-20 contract address per network
// ─────────────────────────────────────────────────────────────────────────────
fn zion_contract(network: &str) -> Option<&'static str> {
    match network {
        "mainnet" => {
            warn!("[WARP][tron] mainnet ZION contract is a placeholder — update after deployment");
            Some("TWZIONxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        }
        "nile" => {
            warn!("[WARP][tron] nile testnet ZION contract is a placeholder");
            Some("TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxtest")
        }
        _ => None,
    }
}

fn default_api(network: &str) -> &'static str {
    match network {
        "nile" => "https://nile.trongrid.io",
        "shasta" => "https://api.shasta.trongrid.io",
        _ => "https://api.trongrid.io",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TronGrid REST response structures
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
struct TronEventsResp {
    data: Option<Vec<TronEvent>>,
}

#[derive(Deserialize)]
struct TronEvent {
    transaction_id: String,
    block_number: Option<u64>,
    result: Option<TronEventResult>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TronEventResult {
    #[serde(rename = "from")]
    from_addr: Option<String>,
    amount: Option<String>, // uint256 as decimal string
    dest_addr: Option<String>,
}

#[derive(Deserialize)]
struct TronBlockResp {
    block_header: Option<TronBlockHeader>,
}

#[derive(Deserialize)]
struct TronBlockHeader {
    raw_data: Option<TronBlockRaw>,
}

#[derive(Deserialize)]
struct TronBlockRaw {
    number: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TronTxInfo {
    block_number: Option<u64>,
    confirmations: Option<u64>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Tron adapter — TRC-20 ZION burn/mint via TronGrid REST API.
pub struct TronAdapter {
    network: String,
    api_url: String,
    #[allow(dead_code)]
    api_key: Option<String>,
    client: reqwest::Client,
}

impl Default for TronAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl TronAdapter {
    pub fn new() -> Self {
        let network = std::env::var("TRON_NETWORK").unwrap_or_else(|_| "mainnet".into());
        let api_url =
            std::env::var("WARP_TRON_API").unwrap_or_else(|_| default_api(&network).to_string());
        let api_key = std::env::var("TRON_API_KEY").ok();
        let mut builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15));
        if let Some(ref key) = api_key {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "TRON-PRO-API-KEY",
                reqwest::header::HeaderValue::from_str(key).unwrap(),
            );
            builder = builder.default_headers(headers);
        }
        Self {
            network,
            api_url,
            api_key,
            client: builder.build().unwrap(),
        }
    }

    async fn get_now_block(&self) -> WarpResult<u64> {
        let url = format!("{}/wallet/getnowblock", self.api_url);
        let resp: TronBlockResp = self
            .client
            .post(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: e.to_string(),
            })?;
        Ok(resp
            .block_header
            .and_then(|h| h.raw_data)
            .and_then(|r| r.number)
            .unwrap_or(0))
    }

    async fn get_contract_events(&self, contract: &str) -> WarpResult<Vec<TronEvent>> {
        let url = format!(
            "{}/v1/contracts/{}/events?event_name=BridgeBurn&limit=40&order_by=block_number,desc",
            self.api_url, contract
        );
        let resp: TronEventsResp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: e.to_string(),
            })?;
        Ok(resp.data.unwrap_or_default())
    }

    fn event_to_proof(&self, ev: &TronEvent, current_block: u64) -> Option<DepositProof> {
        let res = ev.result.as_ref()?;
        let amount: u64 = res
            .amount
            .as_deref()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        if amount == 0 {
            return None;
        }
        let dest = res.dest_addr.clone().unwrap_or_default();
        let from = res.from_addr.clone().unwrap_or_default();
        let block = ev.block_number.unwrap_or(0);
        Some(DepositProof {
            tx_hash: ev.transaction_id.clone(),
            block_height: block,
            block_hash: format!("tron-block-{}", block),
            sender: from,
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:tron:{}", dest),
            confirmations: current_block.saturating_sub(block),
        })
    }
}

#[async_trait]
impl ChainAdapter for TronAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Tron
    }
    fn name(&self) -> &str {
        "tron"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_now_block().await {
            Ok(n) => {
                info!("[WARP][tron] Health OK — block {}", n);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][tron] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let contract = match zion_contract(&self.network) {
            Some(c) => c,
            None => {
                debug!("[WARP][tron] No ZION contract configured");
                return Ok(vec![]);
            }
        };
        let tip = self.get_now_block().await?;
        let events = self.get_contract_events(contract).await?;
        let proofs: Vec<_> = events
            .iter()
            .filter_map(|e| self.event_to_proof(e, tip))
            .collect();
        info!("[WARP][tron] {} BridgeBurn events", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let contract = match zion_contract(&self.network) {
            Some(c) => c,
            None => {
                return Err(WarpError::AdapterError {
                    chain: "tron".into(),
                    reason: format!(
                        "no ZION contract configured for network '{}'",
                        self.network
                    ),
                });
            }
        };
        let signer = TronSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "tron".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;
        let amount = instruction.amount_dest_atomic as u64;
        info!(
            "[WARP][tron] minting {} ZION to {} on {} (contract {})",
            amount, instruction.recipient, self.network, contract
        );
        signer
            .mint_trc20(
                &self.client,
                &self.api_url,
                contract,
                &instruction.recipient,
                amount,
            )
            .await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.get_now_block().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let url = format!("{}/v1/transactions/{}/info", self.api_url, tx_hash);
        let resp: TronTxInfo = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: e.to_string(),
            })?;
        if let Some(c) = resp.confirmations {
            return Ok(c);
        }
        let tip = self.get_now_block().await.unwrap_or(0);
        Ok(tip.saturating_sub(resp.block_number.unwrap_or(tip)))
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
    fn test_tron_adapter_meta() {
        let a = TronAdapter::new();
        assert_eq!(a.family(), ChainFamily::Tron);
        assert_eq!(a.name(), "tron");
    }

    #[test]
    fn test_zion_contract_mainnet() {
        assert!(zion_contract("mainnet").is_some());
    }

    #[test]
    fn test_event_to_proof_valid() {
        let adapter = TronAdapter::new();
        let ev = TronEvent {
            transaction_id: "TXHASH1".into(),
            block_number: Some(60_000_000),
            result: Some(TronEventResult {
                from_addr: Some("TFrom123".into()),
                amount: Some("2000000".into()),
                dest_addr: Some("zion1xyz".into()),
            }),
        };
        let proof = adapter.event_to_proof(&ev, 60_000_010).unwrap();
        assert_eq!(proof.amount_flowers, 2_000_000);
        assert_eq!(proof.memo, "WARP_INBOUND:tron:zion1xyz");
        assert_eq!(proof.confirmations, 10);
    }

    #[test]
    fn test_event_to_proof_zero_amount_skipped() {
        let adapter = TronAdapter::new();
        let ev = TronEvent {
            transaction_id: "TX".into(),
            block_number: Some(1),
            result: Some(TronEventResult {
                from_addr: None,
                amount: Some("0".into()),
                dest_addr: None,
            }),
        };
        assert!(adapter.event_to_proof(&ev, 100).is_none());
    }

    #[tokio::test]
    async fn test_tron_execute_mint_is_err() {
        let inst = MintInstruction {
            dest_chain: "tron".into(),
            recipient: "TAddr".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(TronAdapter::new().execute_mint(&inst).await.is_err());
    }
}
