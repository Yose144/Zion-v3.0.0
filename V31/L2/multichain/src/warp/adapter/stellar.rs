use crate::warp::adapter::ChainAdapter;
use crate::warp::config::ChainConfig;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::stellar_signer::StellarSigner;
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// ZION Stellar asset issuer per network
// ─────────────────────────────────────────────────────────────────────────────
// Contract source: V3/L2/bridge/contracts/non-evm/stellar/zion_asset.toml
// Setup script:    V3/L2/bridge/contracts/non-evm/stellar/setup_zion_asset.py
// Deployment steps: V3/L2/bridge/contracts/non-evm/stellar/README.md
//
// ZION on Stellar is a native asset (code="ZION", issuer=bridge account).
// The issuer account is a 5/5 multisig controlled by WARP validators.
// After running setup_zion_asset.py, replace the placeholder issuer
// addresses below with the real bridge account public key (G...).
fn zion_contract_with_override(network: &str, issuer_override: Option<&str>) -> Option<String> {
    // Config override takes priority.
    if let Some(issuer) = issuer_override {
        if !issuer.is_empty() {
            return Some(issuer.to_string());
        }
    }

    // Allow override via env var.
    if let Ok(issuer) = std::env::var("WARP_STELLAR_ZION_ISSUER") {
        if !issuer.is_empty() {
            return Some(issuer);
        }
    }

    match network {
        "mainnet" => {
            // ✅ DEPLOYED 2026-07-13 — ZION native asset on Stellar mainnet
            // Asset: ZION/GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT
            // TX: 5c1d2ba0834f815dae0e769df89e4fdc0392da2145e1df8848603db42386ec95
            // Flags: auth_required, auth_revocable, auth_immutable
            // Home domain: zionterranova.com
            // TODO: Add 5 WARP validators as multi-sig signers (5/5 quorum)
            // TODO: Set WARP_STELLAR_RELAY_KEY for relay signing
            Some("GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT".to_string())
        }
        "testnet" => {
            warn!("[WARP][stellar] testnet ZION issuer is a placeholder — run setup_zion_asset.py and set WARP_STELLAR_ZION_ISSUER env var");
            Some("CZIONTEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX".to_string())
        }
        _ => None,
    }
}

#[allow(dead_code)]
fn zion_contract(network: &str) -> Option<String> {
    zion_contract_with_override(network, None)
}

fn default_horizon(network: &str) -> &'static str {
    match network {
        "testnet" => "https://horizon-testnet.stellar.org",
        "futurenet" => "https://horizon-futurenet.stellar.org",
        _ => "https://horizon.stellar.org",
    }
}

fn default_soroban(network: &str) -> &'static str {
    match network {
        "testnet" => "https://soroban-testnet.stellar.org",
        _ => "https://mainnet.sorobanrpc.com",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizon REST structures
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
struct HorizonLedgerPage {
    _embedded: Option<HorizonEmbedded<HorizonLedger>>,
}

#[derive(Deserialize)]
struct HorizonEmbedded<T> {
    records: Vec<T>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct HorizonLedger {
    sequence: u64,
    closed_at: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Soroban JSON-RPC (getEvents)
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Serialize)]
struct SorobanRpcReq<'a> {
    jsonrpc: &'a str,
    id: u32,
    method: &'a str,
    params: Value,
}

#[derive(Deserialize)]
struct SorobanRpcResp {
    result: Option<SorobanEventsResult>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct SorobanEventsResult {
    events: Vec<SorobanEvent>,
    latest_ledger: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct SorobanEvent {
    id: String,
    ledger: Option<u64>,
    tx_hash: Option<String>,
    contract_id: Option<String>,
    topic: Option<Vec<Value>>,
    value: Option<Value>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Stellar adapter — Soroban smart contract events via Stellar RPC.
pub struct StellarAdapter {
    network: String,
    horizon_url: String,
    soroban_url: String,
    client: reqwest::Client,
    issuer_override: Option<String>,
}

impl Default for StellarAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl StellarAdapter {
    pub fn new() -> Self {
        let network = std::env::var("STELLAR_NETWORK").unwrap_or_else(|_| "mainnet".into());
        let horizon_url = std::env::var("WARP_STELLAR_HORIZON")
            .unwrap_or_else(|_| default_horizon(&network).to_string());
        let soroban_url = std::env::var("WARP_STELLAR_SOROBAN")
            .unwrap_or_else(|_| default_soroban(&network).to_string());
        Self {
            network,
            horizon_url,
            soroban_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
            issuer_override: None,
        }
    }

    pub fn from_config(cfg: &ChainConfig) -> Self {
        let mut adapter = Self::new();
        if !cfg.rpc_url.is_empty() {
            adapter.horizon_url = cfg.rpc_url.clone();
        }
        if let Some(issuer) = &cfg.contract_address {
            if !issuer.is_empty() {
                adapter.issuer_override = Some(issuer.clone());
            }
        }
        adapter
    }

    async fn latest_ledger(&self) -> WarpResult<u64> {
        let url = format!("{}/ledgers?order=desc&limit=1", self.horizon_url);
        let resp: HorizonLedgerPage = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: e.to_string(),
            })?;
        Ok(resp
            ._embedded
            .and_then(|e| e.records.into_iter().next())
            .map(|l| l.sequence)
            .unwrap_or(0))
    }

    /// Fetch BridgeBurn events via Soroban `getEvents` RPC.
    async fn get_bridge_burn_events(
        &self,
        contract: &str,
        start_ledger: u64,
    ) -> WarpResult<Vec<DepositProof>> {
        let body = SorobanRpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "getEvents",
            params: json!({
                "startLedger": start_ledger,
                "filters": [{
                    "type": "contract",
                    "contractIds": [contract],
                    // topic[0] = Symbol("BridgeBurn")
                    "topics": [["AAAAAA=="], ["*"]]
                }],
                "pagination": { "limit": 50 }
            }),
        };
        let resp: SorobanRpcResp = self
            .client
            .post(&self.soroban_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: e.to_string(),
            })?;

        let result = match resp.result {
            Some(r) => r,
            None => return Ok(vec![]),
        };
        let latest = result.latest_ledger.unwrap_or(start_ledger);

        let proofs: Vec<DepositProof> = result
            .events
            .iter()
            .filter_map(|e| self.parse_soroban_event(e, latest))
            .collect();
        Ok(proofs)
    }

    /// Parse a Soroban BridgeBurn event into a DepositProof.
    /// Expected value: { "amount": "<u64>", "dest": "<zion_addr>", "from": "<stellar_addr>" }
    fn parse_soroban_event(&self, ev: &SorobanEvent, latest_ledger: u64) -> Option<DepositProof> {
        let val = ev.value.as_ref()?;
        let amount: u64 = val["amount"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| val["amount"].as_u64())
            .unwrap_or(0);
        if amount == 0 {
            return None;
        }

        let dest = val["dest"].as_str().unwrap_or("").to_string();
        let from = val["from"].as_str().unwrap_or("").to_string();
        let ledger = ev.ledger.unwrap_or(latest_ledger);
        let tx = ev
            .tx_hash
            .clone()
            .unwrap_or_else(|| format!("stellar-ev-{}", ev.id));

        Some(DepositProof {
            tx_hash: tx,
            block_height: ledger,
            block_hash: format!("stellar-ledger-{}", ledger),
            sender: from,
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:stellar:{}", dest),
            confirmations: latest_ledger.saturating_sub(ledger),
        })
    }
}

#[async_trait]
impl ChainAdapter for StellarAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Stellar
    }
    fn name(&self) -> &str {
        "stellar"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.latest_ledger().await {
            Ok(l) => {
                info!("[WARP][stellar] Health OK — ledger {}", l);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][stellar] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let contract =
            match zion_contract_with_override(&self.network, self.issuer_override.as_deref()) {
                Some(c) => c,
                None => {
                    debug!("[WARP][stellar] No ZION contract configured");
                    return Ok(vec![]);
                }
            };
        let ledger = self.latest_ledger().await?;
        let start = ledger.saturating_sub(100); // look back ~100 ledgers (~8 mins)
        let proofs = self.get_bridge_burn_events(&contract, start).await?;
        info!(
            "[WARP][stellar] {} BridgeBurn events (ledgers {}-{})",
            proofs.len(),
            start,
            ledger
        );
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        // amount_dest_atomic is in Stellar stroops (7 decimals)
        let amount_stroops = instruction.amount_dest_atomic as i64;

        let signer = match StellarSigner::from_env() {
            Ok(s) => s,
            Err(_) => {
                return Err(WarpError::AdapterError {
                    chain: "stellar".into(),
                    reason: format!(
                        "WARP_STELLAR_RELAY_KEY not set — cannot send {} stroops to {}. \
                         Set env var with a funded Stellar relay wallet secret key (S...).",
                        amount_stroops, instruction.recipient
                    ),
                });
            }
        };

        info!(
            "[WARP][stellar] execute_mint: {} stroops → {} (relay: {})",
            amount_stroops,
            instruction.recipient,
            signer.address()
        );

        signer
            .send_payment(
                &self.client,
                &self.horizon_url,
                &instruction.recipient,
                amount_stroops,
            )
            .await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.latest_ledger().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        // GET /transactions/{hash} → ledger, compare to latest
        let url = format!("{}/transactions/{}", self.horizon_url, tx_hash);
        let resp: Value = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: e.to_string(),
            })?;
        let tx_ledger = resp["ledger"].as_u64().unwrap_or(0);
        let latest = self.latest_ledger().await.unwrap_or(tx_ledger);
        Ok(latest.saturating_sub(tx_ledger))
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
    fn test_stellar_adapter_meta() {
        let a = StellarAdapter::new();
        assert_eq!(a.family(), ChainFamily::Stellar);
        assert_eq!(a.name(), "stellar");
    }

    #[test]
    fn test_zion_contract_mainnet() {
        assert!(zion_contract("mainnet").is_some());
        assert!(zion_contract("testnet").is_some());
        assert!(zion_contract("unknown").is_none());
    }

    #[test]
    fn test_parse_soroban_event_valid() {
        let adapter = StellarAdapter::new();
        let ev = SorobanEvent {
            id: "ev1".into(),
            ledger: Some(50_000),
            tx_hash: Some("TXHASH".into()),
            contract_id: None,
            topic: None,
            value: Some(json!({ "amount": "3000000", "dest": "zion1stellar", "from": "GA..." })),
        };
        let proof = adapter.parse_soroban_event(&ev, 50_005).unwrap();
        assert_eq!(proof.amount_flowers, 3_000_000);
        assert_eq!(proof.memo, "WARP_INBOUND:stellar:zion1stellar");
        assert_eq!(proof.confirmations, 5);
    }

    #[test]
    fn test_parse_soroban_event_zero_amount_skipped() {
        let adapter = StellarAdapter::new();
        let ev = SorobanEvent {
            id: "ev2".into(),
            ledger: Some(1),
            tx_hash: None,
            contract_id: None,
            topic: None,
            value: Some(json!({ "amount": "0", "dest": "zion1x", "from": "GA..." })),
        };
        assert!(adapter.parse_soroban_event(&ev, 10).is_none());
    }

    #[tokio::test]
    async fn test_stellar_execute_mint_is_err() {
        let inst = MintInstruction {
            dest_chain: "stellar".into(),
            recipient: "GADDR".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(StellarAdapter::new().execute_mint(&inst).await.is_err());
    }
}
