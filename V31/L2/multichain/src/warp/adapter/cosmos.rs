use crate::warp::adapter::ChainAdapter;
use crate::warp::config::ChainConfig;
use crate::warp::cosmos_signer::CosmosSigner;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// ZION CosmWasm contract address per network
// ─────────────────────────────────────────────────────────────────────────────
// Contract source: V3/L2/bridge/contracts/non-evm/cosmos/zion_cw20.rs
// Deployment steps: V3/L2/bridge/contracts/non-evm/cosmos/README.md
//
// After deploying the CW20 contract (zion_cw20.rs) to a CosmWasm-enabled
// chain, replace the placeholder addresses below with the real bech32
// contract address (e.g., cosmos1...).
fn zion_contract_with_override(network: &str, contract_override: Option<&str>) -> Option<String> {
    if let Some(contract) = contract_override {
        if !contract.is_empty() {
            return Some(contract.to_string());
        }
    }
    if let Ok(contract) = std::env::var("WARP_COSMOS_CONTRACT") {
        if !contract.is_empty() {
            return Some(contract);
        }
    }
    match network {
        "cosmoshub-4" => {
            // TODO: Replace with real cosmoshub-4 ZION CW20 contract address.
            // Deploy zion_cw20.rs via: wasmd tx wasm store + wasmd tx wasm instantiate
            // The contract address will be a cosmos1... bech32 address.
            warn!("[WARP][cosmos] cosmoshub-4 ZION contract is a placeholder — deploy CW20 from V3/L2/bridge/contracts/non-evm/cosmos/ and update this address");
            Some("cosmos1zionwarpxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".to_string())
        }
        "theta-testnet-001" => {
            // TODO: Replace with real theta-testnet ZION CW20 contract address.
            // Deploy zion_cw20.rs to the theta testnet for testing.
            warn!("[WARP][cosmos] theta-testnet ZION contract is a placeholder — deploy CW20 from V3/L2/bridge/contracts/non-evm/cosmos/ and update this address");
            Some("cosmos1ziontexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".to_string())
        }
        _ => None,
    }
}

#[allow(dead_code)]
fn zion_contract(network: &str) -> Option<String> {
    zion_contract_with_override(network, None)
}

fn default_rest(network: &str) -> &'static str {
    match network {
        "theta-testnet-001" => "https://rest.cosmos.directory/cosmoshubtestnet",
        _ => "https://rest.cosmos.directory/cosmoshub",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CosmosSDK REST structures
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
#[allow(dead_code)]
struct CosmosTxsResp {
    txs: Option<Vec<CosmosRawTx>>,
    tx_responses: Option<Vec<CosmosRawTxResp>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CosmosRawTx {}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CosmosRawTxResp {
    txhash: Option<String>,
    height: Option<String>,
    logs: Option<Vec<CosmosLog>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CosmosLog {
    events: Option<Vec<CosmosEvent>>,
}

#[derive(Deserialize)]
struct CosmosEvent {
    #[serde(rename = "type")]
    type_: String,
    attributes: Vec<CosmosAttr>,
}

#[derive(Deserialize)]
struct CosmosAttr {
    key: String,
    value: Option<String>,
}

#[derive(Deserialize)]
struct CosmosBlockResp {
    block: Option<CosmosBlock>,
}

#[derive(Deserialize)]
struct CosmosBlock {
    header: Option<CosmosBlockHeader>,
}

#[derive(Deserialize)]
struct CosmosBlockHeader {
    height: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Cosmos adapter — CosmWASM contract events via CosmosSDK REST.
pub struct CosmosAdapter {
    network: String,
    rest_url: String,
    client: reqwest::Client,
    contract_override: Option<String>,
}

impl Default for CosmosAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CosmosAdapter {
    pub fn new() -> Self {
        let network = std::env::var("COSMOS_NETWORK").unwrap_or_else(|_| "cosmoshub-4".into());
        let rest_url = std::env::var("WARP_COSMOS_REST")
            .unwrap_or_else(|_| default_rest(&network).to_string());
        Self {
            network,
            rest_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
            contract_override: None,
        }
    }

    pub fn from_config(cfg: &ChainConfig) -> Self {
        let mut adapter = Self::new();
        if !cfg.rpc_url.is_empty() {
            adapter.rest_url = cfg.rpc_url.clone();
        }
        if let Some(contract) = &cfg.contract_address {
            if !contract.is_empty() {
                adapter.contract_override = Some(contract.clone());
            }
        }
        adapter
    }

    async fn latest_height(&self) -> WarpResult<u64> {
        let url = format!(
            "{}/cosmos/base/tendermint/v1beta1/blocks/latest",
            self.rest_url
        );
        let resp: CosmosBlockResp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: e.to_string(),
            })?;
        Ok(resp
            .block
            .and_then(|b| b.header)
            .and_then(|h| h.height)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0))
    }

    /// Query WASM BridgeBurn events via CosmosSDK tx search.
    async fn query_bridge_burn_txs(&self, contract: &str) -> WarpResult<Vec<CosmosRawTxResp>> {
        // Query: wasm._contract_address=<contract>&wasm.action=bridge_burn
        let events_query = format!(
            "wasm._contract_address%3D'{}'%20AND%20wasm.action%3D'bridge_burn'",
            contract
        );
        let url = format!(
            "{}/cosmos/tx/v1beta1/txs?events={}&pagination.limit=50&order_by=ORDER_BY_DESC",
            self.rest_url, events_query
        );
        let resp: CosmosTxsResp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: e.to_string(),
            })?;
        Ok(resp.tx_responses.unwrap_or_default())
    }

    fn parse_tx_response(&self, tx: &CosmosRawTxResp, tip: u64) -> Option<DepositProof> {
        let tx_hash = tx.txhash.clone()?;
        let height: u64 = tx
            .height
            .as_deref()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let logs = tx.logs.as_ref()?;
        let mut amount_flowers: Option<u64> = None;
        let mut dest_addr = String::new();
        let mut sender = String::new();

        for log in logs {
            for event in log.events.as_deref().unwrap_or_default() {
                if event.type_ == "wasm" {
                    for attr in &event.attributes {
                        match attr.key.as_str() {
                            "amount" => {
                                amount_flowers = attr.value.as_deref().and_then(|v| v.parse().ok());
                            }
                            "dest_addr" | "destAddr" => {
                                dest_addr = attr.value.clone().unwrap_or_default();
                            }
                            "sender" => {
                                sender = attr.value.clone().unwrap_or_default();
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        let amount = amount_flowers?;
        if amount == 0 || dest_addr.is_empty() {
            return None;
        }

        Some(DepositProof {
            tx_hash,
            block_height: height,
            block_hash: format!("cosmos-block-{}", height),
            sender,
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:cosmos:{}", dest_addr),
            confirmations: tip.saturating_sub(height),
        })
    }
}

#[async_trait]
impl ChainAdapter for CosmosAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Cosmos
    }
    fn name(&self) -> &str {
        "cosmos"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.latest_height().await {
            Ok(h) => {
                info!("[WARP][cosmos] Health OK — height {}", h);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][cosmos] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let contract =
            match zion_contract_with_override(&self.network, self.contract_override.as_deref()) {
                Some(c) => c,
                None => {
                    debug!("[WARP][cosmos] No ZION contract configured");
                    return Ok(vec![]);
                }
            };
        let tip = self.latest_height().await?;
        let txs = self.query_bridge_burn_txs(&contract).await?;
        let proofs: Vec<_> = txs
            .iter()
            .filter_map(|tx| self.parse_tx_response(tx, tip))
            .collect();
        info!("[WARP][cosmos] {} BridgeBurn txs", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let contract =
            zion_contract_with_override(&self.network, self.contract_override.as_deref())
                .ok_or_else(|| WarpError::AdapterError {
                    chain: "cosmos".into(),
                    reason: format!("no ZION contract configured for network '{}'", self.network),
                })?;

        let signer = CosmosSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "cosmos".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;

        let amount = instruction.amount_dest_atomic as u64;
        info!(
            "[WARP][cosmos] minting {} ZION to {} on {} (contract {})",
            amount, instruction.recipient, self.network, contract
        );

        signer
            .execute_contract_mint(
                &self.client,
                &self.rest_url,
                &contract,
                &instruction.recipient,
                amount,
            )
            .await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.latest_height().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let url = format!("{}/cosmos/tx/v1beta1/txs/{}", self.rest_url, tx_hash);
        let resp: Value = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: e.to_string(),
            })?;
        let tx_height: u64 = resp["tx_response"]["height"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let tip = self.latest_height().await.unwrap_or(tx_height);
        Ok(tip.saturating_sub(tx_height))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::protocol::MintInstruction;

    #[test]
    fn test_cosmos_adapter_meta() {
        let a = CosmosAdapter::new();
        assert_eq!(a.family(), ChainFamily::Cosmos);
        assert_eq!(a.name(), "cosmos");
    }

    #[test]
    fn test_zion_contract_cosmoshub() {
        assert!(zion_contract("cosmoshub-4").is_some());
    }

    #[test]
    fn test_parse_tx_response_valid() {
        let adapter = CosmosAdapter::new();
        let tx = CosmosRawTxResp {
            txhash: Some("TXHASH".into()),
            height: Some("7000000".into()),
            logs: Some(vec![CosmosLog {
                events: Some(vec![CosmosEvent {
                    type_: "wasm".into(),
                    attributes: vec![
                        CosmosAttr {
                            key: "amount".into(),
                            value: Some("4000000".into()),
                        },
                        CosmosAttr {
                            key: "dest_addr".into(),
                            value: Some("zion1cosmos".into()),
                        },
                        CosmosAttr {
                            key: "sender".into(),
                            value: Some("cosmos1abc".into()),
                        },
                    ],
                }]),
            }]),
        };
        let proof = adapter.parse_tx_response(&tx, 7_000_010).unwrap();
        assert_eq!(proof.amount_flowers, 4_000_000);
        assert_eq!(proof.memo, "WARP_INBOUND:cosmos:zion1cosmos");
        assert_eq!(proof.confirmations, 10);
    }

    #[tokio::test]
    async fn test_cosmos_execute_mint_no_key_is_err() {
        // Without WARP_COSMOS_RELAY_KEY, execute_mint should error
        std::env::remove_var("WARP_COSMOS_RELAY_KEY");
        let inst = MintInstruction {
            dest_chain: "cosmos".into(),
            recipient: "cosmos1abc".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(CosmosAdapter::new().execute_mint(&inst).await.is_err());
    }
}
