use crate::warp::adapter::ChainAdapter;
use crate::warp::btc_signer::BtcSigner;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use bitcoin::Network;
use serde::Deserialize;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// HTLC watch address & OP_RETURN prefix
// ─────────────────────────────────────────────────────────────────────────────
const WARP_OP_RETURN_PREFIX: &str = "WARP_INBOUND:bitcoin:";
// OP_RETURN data is hex-encoded — we look for the prefix in decoded ASCII.

fn htlc_address(network: &str) -> Option<&'static str> {
    match network {
        "mainnet" => {
            warn!(
                "[WARP][bitcoin] mainnet HTLC address is a placeholder — update after deployment"
            );
            Some("bc1qzionhtlcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        }
        "testnet" => {
            warn!("[WARP][bitcoin] testnet HTLC address is a placeholder");
            Some("tb1qzionhtlctest0000000000000000000000000000")
        }
        _ => None,
    }
}

fn default_api(network: &str) -> &'static str {
    match network {
        "testnet" => "https://mempool.space/testnet/api",
        "signet" => "https://mempool.space/signet/api",
        _ => "https://mempool.space/api",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// mempool.space REST structures
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
#[allow(dead_code)]
struct MempoolTx {
    txid: String,
    status: Option<MempoolTxStatus>,
    vout: Option<Vec<MempoolVout>>,
    vin: Option<Vec<MempoolVin>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MempoolTxStatus {
    confirmed: bool,
    block_height: Option<u64>,
    block_hash: Option<String>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MempoolVout {
    value: u64,
    scriptpubkey_type: Option<String>,
    scriptpubkey_asm: Option<String>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MempoolVin {
    prevout: Option<MempoolVout>,
    scriptsig_asm: Option<String>,
    witness: Option<Vec<String>>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Bitcoin adapter — HTLC watch + OP_RETURN memo parsing via mempool.space API.
pub struct BitcoinAdapter {
    network: String,
    api_url: String,
    client: reqwest::Client,
}

impl Default for BitcoinAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl BitcoinAdapter {
    pub fn new() -> Self {
        let network = std::env::var("BITCOIN_NETWORK").unwrap_or_else(|_| "mainnet".into());
        let api_url =
            std::env::var("WARP_BITCOIN_API").unwrap_or_else(|_| default_api(&network).to_string());
        Self {
            network,
            api_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .unwrap(),
        }
    }

    async fn get_tip_height(&self) -> WarpResult<u64> {
        let url = format!("{}/blocks/tip/height", self.api_url);
        let text = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: e.to_string(),
            })?
            .text()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: e.to_string(),
            })?;
        text.trim()
            .parse::<u64>()
            .map_err(|_| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: format!("tip height parse error: '{}'", text.trim()),
            })
    }

    async fn get_address_txs(&self, address: &str) -> WarpResult<Vec<MempoolTx>> {
        // mempool.space returns max 50 confirmed + unconfirmed txs
        let url = format!("{}/address/{}/txs", self.api_url, address);
        let txs: Vec<MempoolTx> = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: e.to_string(),
            })?;
        Ok(txs)
    }

    /// Decode hex-encoded OP_RETURN data and look for WARP_INBOUND prefix.
    /// OP_RETURN ASM format: "OP_RETURN OP_PUSHBYTES_N <hex>"
    fn parse_op_return(asm: &str) -> Option<String> {
        let hex_part = asm.split_whitespace().last()?;
        if hex_part.len() < 2 {
            return None;
        }
        let bytes = (0..hex_part.len())
            .step_by(2)
            .filter_map(|i| u8::from_str_radix(&hex_part[i..i + 2], 16).ok())
            .collect::<Vec<u8>>();
        let s = String::from_utf8(bytes).ok()?;
        if s.starts_with("WARP_INBOUND:bitcoin:") {
            Some(s[WARP_OP_RETURN_PREFIX.len()..].to_string())
        } else {
            None
        }
    }

    fn tx_to_proof(&self, tx: &MempoolTx, tip: u64) -> Option<DepositProof> {
        let status = tx.status.as_ref()?;
        // Only confirmed transactions
        if !status.confirmed {
            return None;
        }

        // Find OP_RETURN output with WARP_INBOUND prefix
        let vouts = tx.vout.as_deref()?;
        let zion_addr = vouts
            .iter()
            .filter(|v| v.scriptpubkey_type.as_deref() == Some("op_return"))
            .filter_map(|v| {
                v.scriptpubkey_asm
                    .as_deref()
                    .and_then(Self::parse_op_return)
            })
            .next()?;

        // Sum value sent to HTLC address (all non-OP_RETURN outputs — simplification)
        let amount_sats: u64 = vouts
            .iter()
            .filter(|v| v.scriptpubkey_type.as_deref() != Some("op_return"))
            .map(|v| v.value)
            .sum();
        if amount_sats == 0 {
            return None;
        }

        let block_height = status.block_height.unwrap_or(0);
        let confirms = tip.saturating_sub(block_height).min(6); // display max 6

        Some(DepositProof {
            tx_hash: tx.txid.clone(),
            block_height,
            block_hash: status.block_hash.clone().unwrap_or_default(),
            sender: String::new(), // Bitcoin doesn't have a single "from" address easily
            amount_flowers: amount_sats, // satoshis (8 decimals)
            memo: format!("WARP_INBOUND:bitcoin:{}", zion_addr),
            confirmations: confirms,
        })
    }
}

#[async_trait]
impl ChainAdapter for BitcoinAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Bitcoin
    }
    fn name(&self) -> &str {
        "bitcoin"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_tip_height().await {
            Ok(h) => {
                info!("[WARP][bitcoin] Health OK — block #{}", h);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][bitcoin] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let address = match htlc_address(&self.network) {
            Some(a) => a,
            None => {
                debug!("[WARP][bitcoin] No HTLC address configured");
                return Ok(vec![]);
            }
        };
        let tip = self.get_tip_height().await?;
        let txs = self.get_address_txs(address).await?;
        let proofs: Vec<_> = txs
            .iter()
            .filter_map(|tx| self.tx_to_proof(tx, tip))
            .collect();
        info!(
            "[WARP][bitcoin] {} HTLC deposits found in {} txs",
            proofs.len(),
            txs.len()
        );
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let amount_sats = instruction.amount_dest_atomic as u64;

        // Attempt to load the relay key from env
        let network_str = std::env::var("BITCOIN_NETWORK").unwrap_or_else(|_| "mainnet".into());
        let _network = match network_str.as_str() {
            "testnet" => Network::Testnet,
            "signet" => Network::Signet,
            "regtest" => Network::Regtest,
            _ => Network::Bitcoin,
        };

        let signer = match BtcSigner::from_env() {
            Ok(s) => s,
            Err(_) => {
                // No key set — run a balance check as dry-run verification
                return Err(WarpError::AdapterError {
                    chain: "bitcoin".into(),
                    reason: format!(
                        "WARP_BTC_RELAY_KEY not set — cannot send {} sats to {}. \
                         Set the env var with a funded P2WPKH relay wallet WIF key.",
                        amount_sats, instruction.recipient
                    ),
                });
            }
        };

        info!(
            "[WARP][bitcoin] execute_mint: {} sats → {} (relay: {})",
            amount_sats,
            instruction.recipient,
            signer.address()
        );

        signer
            .send_btc(
                &self.client,
                &self.api_url,
                &instruction.recipient,
                amount_sats,
            )
            .await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.get_tip_height().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let url = format!("{}/tx/{}/status", self.api_url, tx_hash);
        let status: MempoolTxStatus = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: e.to_string(),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: e.to_string(),
            })?;
        if !status.confirmed {
            return Ok(0);
        }
        let tx_block = status.block_height.unwrap_or(0);
        let tip = self.get_tip_height().await.unwrap_or(tx_block);
        Ok(tip.saturating_sub(tx_block) + 1)
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
    fn test_bitcoin_adapter_meta() {
        let a = BitcoinAdapter::new();
        assert_eq!(a.family(), ChainFamily::Bitcoin);
        assert_eq!(a.name(), "bitcoin");
    }

    #[test]
    fn test_parse_op_return_valid() {
        let hex: String = "WARP_INBOUND:bitcoin:zion1btcabc"
            .bytes()
            .map(|b| format!("{:02x}", b))
            .collect();
        let asm = format!("OP_RETURN OP_PUSHBYTES_36 {}", hex);
        let result = BitcoinAdapter::parse_op_return(&asm);
        assert_eq!(result, Some("zion1btcabc".to_string()));
    }

    #[test]
    fn test_parse_op_return_wrong_prefix() {
        let hex: String = "RANDOM_DATA:bitcoin:zion1x"
            .bytes()
            .map(|b| format!("{:02x}", b))
            .collect();
        let asm = format!("OP_RETURN OP_PUSHBYTES_30 {}", hex);
        assert!(BitcoinAdapter::parse_op_return(&asm).is_none());
    }

    #[test]
    fn test_tx_to_proof_confirmed() {
        let adapter = BitcoinAdapter::new();
        let hex_memo: String = "WARP_INBOUND:bitcoin:zion1btcuser"
            .bytes()
            .map(|b| format!("{:02x}", b))
            .collect();
        let tx = MempoolTx {
            txid: "BTCTXID".into(),
            status: Some(MempoolTxStatus {
                confirmed: true,
                block_height: Some(840_000),
                block_hash: Some("hash123".into()),
            }),
            vout: Some(vec![
                MempoolVout {
                    value: 100_000,
                    scriptpubkey_type: Some("p2wpkh".into()),
                    scriptpubkey_asm: None,
                },
                MempoolVout {
                    value: 0,
                    scriptpubkey_type: Some("op_return".into()),
                    scriptpubkey_asm: Some(format!("OP_RETURN OP_PUSHBYTES_38 {}", hex_memo)),
                },
            ]),
            vin: None,
        };
        let proof = adapter.tx_to_proof(&tx, 840_005).unwrap();
        assert_eq!(proof.amount_flowers, 100_000);
        assert_eq!(proof.memo, "WARP_INBOUND:bitcoin:zion1btcuser");
    }

    #[test]
    fn test_tx_to_proof_unconfirmed_skipped() {
        let adapter = BitcoinAdapter::new();
        let tx = MempoolTx {
            txid: "TX".into(),
            status: Some(MempoolTxStatus {
                confirmed: false,
                block_height: None,
                block_hash: None,
            }),
            vout: Some(vec![]),
            vin: None,
        };
        assert!(adapter.tx_to_proof(&tx, 840_000).is_none());
    }

    #[tokio::test]
    async fn test_bitcoin_execute_mint_is_err() {
        let inst = MintInstruction {
            dest_chain: "bitcoin".into(),
            recipient: "bc1q...".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(BitcoinAdapter::new().execute_mint(&inst).await.is_err());
    }
}
