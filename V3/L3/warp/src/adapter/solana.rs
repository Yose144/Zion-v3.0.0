use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::solana_signer::SolanaSigner;
use crate::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// ZION SPL token mint address per cluster
// ─────────────────────────────────────────────────────────────────────────────
fn zion_mint(cluster: &str) -> Option<&'static str> {
    // ── ZION SPL Token Mint Address ──────────────────────────────────────
    // Contract source: V3/L2/bridge/contracts/non-evm/solana/zion_spl_token.rs
    // Deployment steps: V3/L2/bridge/contracts/non-evm/solana/README.md
    //
    // After deploying the Anchor program and calling `initialize`, replace
    // the placeholder addresses below with the real ZION mint PDA address.
    // The mint PDA is derived from seeds [b"zion_mint"].
    match cluster {
        "mainnet-beta" => {
            // TODO: Replace with real mainnet ZION mint after deployment.
            // Deploy the Anchor program (zion_spl_token.rs) and call initialize
            // with the 5 WARP validator public keys. The mint PDA address
            // will be the output of `anchor keys list` for the zion_mint account.
            warn!("[WARP][solana] mainnet-beta ZION mint is a placeholder — deploy contract from V3/L2/bridge/contracts/non-evm/solana/ and update this address");
            Some("ZIONmintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
        }
        "devnet" => {
            // TODO: Replace with real devnet ZION mint after test deployment.
            // Use `anchor deploy --provider.cluster devnet` then call initialize.
            warn!("[WARP][solana] devnet ZION mint is a placeholder — deploy contract from V3/L2/bridge/contracts/non-evm/solana/ and update this address");
            Some("ZIONdevXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
        }
        _ => None,
    }
}

fn default_rpc(cluster: &str) -> &'static str {
    match cluster {
        "devnet" => "https://api.devnet.solana.com",
        "testnet" => "https://api.testnet.solana.com",
        _ => "https://api.mainnet-beta.solana.com",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC helpers
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Serialize)]
struct RpcReq<'a> {
    jsonrpc: &'a str,
    id: u32,
    method: &'a str,
    params: Value,
}

#[derive(Deserialize)]
struct RpcResp {
    result: Option<Value>,
}

async fn rpc(
    client: &reqwest::Client,
    url: &str,
    method: &str,
    params: Value,
) -> WarpResult<Value> {
    let body = RpcReq {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
    };
    let resp: RpcResp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: e.to_string(),
        })?;
    resp.result.ok_or_else(|| WarpError::AdapterError {
        chain: "solana".into(),
        reason: "null result".into(),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Solana adapter — SPL Token burn/mint via Anchor ZION program.
/// Uses Solana JSON-RPC directly (no solana-client dependency).
pub struct SolanaAdapter {
    cluster: String,
    rpc_url: String,
    client: reqwest::Client,
}

impl Default for SolanaAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SolanaAdapter {
    pub fn new() -> Self {
        let cluster = std::env::var("SOLANA_CLUSTER").unwrap_or_else(|_| "mainnet-beta".into());
        let rpc_url =
            std::env::var("WARP_SOLANA_RPC").unwrap_or_else(|_| default_rpc(&cluster).to_string());
        Self {
            cluster,
            rpc_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
        }
    }

    /// `getSlot` → current confirmed slot.
    async fn get_slot(&self) -> WarpResult<u64> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "getSlot",
            json!([{"commitment": "confirmed"}]),
        )
        .await?;
        v.as_u64().ok_or_else(|| WarpError::AdapterError {
            chain: "solana".into(),
            reason: "getSlot: non-u64 result".into(),
        })
    }

    /// `getSignaturesForAddress(mint, limit=40)` → list of recent signatures.
    async fn get_signatures_for_address(
        &self,
        address: &str,
        limit: u64,
    ) -> WarpResult<Vec<SolSig>> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "getSignaturesForAddress",
            json!([address, {"limit": limit, "commitment": "confirmed"}]),
        )
        .await?;
        serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("sig list parse: {}", e),
        })
    }

    /// `getTransaction(sig)` → decoded transaction.
    async fn get_transaction(&self, sig: &str) -> WarpResult<Option<SolTx>> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "getTransaction",
            json!([sig, {"encoding": "json", "commitment": "confirmed",
                         "maxSupportedTransactionVersion": 0}]),
        )
        .await?;
        if v.is_null() {
            return Ok(None);
        }
        let tx: SolTx = serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("tx parse: {}", e),
        })?;
        Ok(Some(tx))
    }

    /// Parse a BridgeBurn proof from Solana transaction log messages.
    /// Expected log format: "Program log: BridgeBurn amount=<u64> dest=<zion_addr>"
    fn parse_bridge_burn_log(&self, tx: &SolTx, sig: &str, slot: u64) -> Option<DepositProof> {
        let meta = tx.meta.as_ref()?;
        let logs = meta.logMessages.as_ref()?;
        let burn_log = logs.iter().find(|l| l.contains("BridgeBurn"))?;

        // Parse: "Program log: BridgeBurn amount=1000000 dest=zion1abc..."
        let amount = burn_log
            .split_once("amount=")
            .and_then(|(_, rest)| rest.split_whitespace().next())
            .and_then(|s| s.parse::<u64>().ok())?;
        let dest = burn_log
            .split_once("dest=")
            .and_then(|(_, rest)| rest.split_whitespace().next())
            .unwrap_or("zion1unknown")
            .to_string();

        let block_slot = tx.slot.unwrap_or(slot);
        let confirm_diff = slot.saturating_sub(block_slot);

        Some(DepositProof {
            tx_hash: sig.to_string(),
            block_height: block_slot,
            block_hash: format!("sol-slot-{}", block_slot),
            sender: tx
                .transaction
                .as_ref()
                .and_then(|t| t.message.accountKeys.first())
                .cloned()
                .unwrap_or_default(),
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:solana:{}", dest),
            confirmations: confirm_diff,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serde helpers
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
#[allow(dead_code)]
struct SolSig {
    signature: String,
    slot: Option<u64>,
    err: Option<Value>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct SolTx {
    slot: Option<u64>,
    transaction: Option<SolTxInner>,
    meta: Option<SolMeta>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct SolTxInner {
    message: SolMsg,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct SolMsg {
    accountKeys: Vec<String>,
}

#[derive(Deserialize)]
#[allow(non_snake_case, dead_code)]
struct SolMeta {
    err: Option<Value>,
    logMessages: Option<Vec<String>>,
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainAdapter impl
// ─────────────────────────────────────────────────────────────────────────────
#[async_trait]
impl ChainAdapter for SolanaAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Solana
    }
    fn name(&self) -> &str {
        "solana"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_slot().await {
            Ok(s) => {
                info!("[WARP][solana] Health OK — slot {}", s);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][solana] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let mint = match zion_mint(&self.cluster) {
            Some(m) => m,
            None => {
                debug!("[WARP][solana] No ZION mint configured");
                return Ok(vec![]);
            }
        };
        let slot = self.get_slot().await?;
        let sigs = self.get_signatures_for_address(mint, 40).await?;
        debug!("[WARP][solana] {} recent sigs on mint {}", sigs.len(), mint);

        let mut proofs = Vec::new();
        for sig_entry in sigs.iter().filter(|s| s.err.is_none()) {
            match self.get_transaction(&sig_entry.signature).await {
                Ok(Some(tx)) => {
                    if let Some(proof) = self.parse_bridge_burn_log(&tx, &sig_entry.signature, slot)
                    {
                        proofs.push(proof);
                    }
                }
                Ok(None) => {}
                Err(e) => warn!("[WARP][solana] getTransaction error: {}", e),
            }
        }
        info!("[WARP][solana] {} BridgeBurn proofs found", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let mint = match zion_mint(&self.cluster) {
            Some(m) => m,
            None => {
                return Err(WarpError::AdapterError {
                    chain: "solana".into(),
                    reason: format!("no ZION mint configured for cluster '{}'", self.cluster),
                });
            }
        };
        let signer = SolanaSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;
        let amount = instruction.amount_dest_atomic as u64;
        info!(
            "[WARP][solana] minting {} ZION to {} on {} (mint {})",
            amount, instruction.recipient, self.cluster, mint
        );
        signer
            .mint_to(
                &self.client,
                &self.rpc_url,
                &instruction.recipient,
                mint,
                amount,
            )
            .await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.get_slot().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "getSignatureStatuses",
            json!([[tx_hash], {"searchTransactionHistory": true}]),
        )
        .await?;
        let slot_now = self.get_slot().await.unwrap_or(0);
        let tx_slot = v["value"][0]["slot"].as_u64().unwrap_or(slot_now);
        Ok(slot_now.saturating_sub(tx_slot))
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
    fn test_solana_adapter_basic() {
        let a = SolanaAdapter::new();
        assert_eq!(a.family(), ChainFamily::Solana);
        assert_eq!(a.name(), "solana");
    }

    #[test]
    fn test_zion_mint_mainnet() {
        assert!(zion_mint("mainnet-beta").is_some());
    }

    #[tokio::test]
    async fn test_solana_execute_mint_is_err() {
        let inst = MintInstruction {
            dest_chain: "solana".into(),
            recipient: "7xKXtg2CW87d97T".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(SolanaAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[test]
    fn test_parse_burn_log_valid() {
        let adapter = SolanaAdapter::new();
        let tx = SolTx {
            slot: Some(300_000_000),
            transaction: Some(SolTxInner {
                message: SolMsg {
                    accountKeys: vec!["7xKXtg2CW87d97T".into()],
                },
            }),
            meta: Some(SolMeta {
                err: None,
                logMessages: Some(vec![
                    "Program log: BridgeBurn amount=5000000 dest=zion1abcde".into(),
                ]),
            }),
        };
        let proof = adapter
            .parse_bridge_burn_log(&tx, "SIG123", 300_000_001)
            .unwrap();
        assert_eq!(proof.amount_flowers, 5_000_000);
        assert_eq!(proof.memo, "WARP_INBOUND:solana:zion1abcde");
        assert_eq!(proof.confirmations, 1);
    }

    #[test]
    fn test_parse_burn_log_no_burnlog_returns_none() {
        let adapter = SolanaAdapter::new();
        let tx = SolTx {
            slot: Some(1),
            transaction: Some(SolTxInner {
                message: SolMsg {
                    accountKeys: vec![],
                },
            }),
            meta: Some(SolMeta {
                err: None,
                logMessages: Some(vec!["Program log: Transfer".into()]),
            }),
        };
        assert!(adapter.parse_bridge_burn_log(&tx, "SIG", 100).is_none());
    }
}
