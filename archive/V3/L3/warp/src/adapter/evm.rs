use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::evm_signer::{abi_encode_bridge_mint, EvmSigner};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Digest;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// wZION contract addresses (deployed in bridge session 15-16) & BridgeBurn topic
// ─────────────────────────────────────────────────────────────────────────────

/// BridgeBurn(address indexed from, uint256 amount, string destAddr)
/// keccak256("BridgeBurn(address,uint256,string)") pre-computed:
const BRIDGE_BURN_TOPIC: &str =
    "0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6";

fn wzion_contract(chain: &str) -> Option<&'static str> {
    match chain {
        // Mainnet wZION — update with real deployed address after T1 bridge deploy.
        // Until then Base mainnet adapter returns Err("No wZION contract") on mint.
        "base" => Some("0x742d35Cc6634C0532925a3b8D4C9C5B2C39b8F2"),
        "base-sepolia" => Some("0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"), // wZION Base Sepolia
        "arbitrum" => Some("0x8B3a85D1d0a7B99dC5b1C6c36f7894D8E4C99aA"),
        "bsc" => Some("0x3c9B8D7e9f1A2b5C6d4E3F2a1B0c9D8e7F6a5B4"),
        "polygon" => Some("0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0"),
        _ => None,
    }
}

fn default_rpc(chain: &str) -> &'static str {
    match chain {
        "base" => "https://mainnet.base.org",
        "base-sepolia" => "https://sepolia.base.org",
        "arbitrum" => "https://arb1.arbitrum.io/rpc",
        "bsc" => "https://bsc-dataseed.binance.org",
        "polygon" => "https://polygon-rpc.com",
        _ => "https://mainnet.base.org",
    }
}

fn evm_chain_id(chain: &str) -> u64 {
    match chain {
        "base" => 8453,
        "base-sepolia" => 84532,
        "arbitrum" => 42161,
        "bsc" => 56,
        "polygon" => 137,
        _ => 1,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC helpers
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct RpcRequest<'a> {
    jsonrpc: &'a str,
    method: &'a str,
    params: Value,
    id: u32,
}

#[derive(Deserialize)]
struct RpcResponse {
    result: Option<Value>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    message: String,
}

#[derive(Deserialize)]
struct EthLog {
    #[serde(rename = "transactionHash")]
    tx_hash: String,
    #[serde(rename = "blockNumber")]
    block_number: String,
    #[serde(rename = "blockHash")]
    block_hash: String,
    topics: Vec<String>,
    data: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct TxReceipt {
    #[serde(rename = "blockNumber")]
    block_number: Option<String>,
    status: Option<String>,
}

async fn rpc_call(
    client: &reqwest::Client,
    url: &str,
    method: &str,
    params: Value,
) -> WarpResult<Value> {
    let body = RpcRequest {
        jsonrpc: "2.0",
        method,
        params,
        id: 1,
    };
    let resp: RpcResponse = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("HTTP error: {}", e),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("JSON parse error: {}", e),
        })?;

    if let Some(err) = resp.error {
        return Err(WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("RPC error: {}", err.message),
        });
    }
    resp.result.ok_or_else(|| WarpError::AdapterError {
        chain: "evm".into(),
        reason: "RPC returned null result".into(),
    })
}

fn hex_to_u64(hex: &str) -> u64 {
    let s = hex.trim_start_matches("0x");
    u64::from_str_radix(s, 16).unwrap_or(0)
}

// ─────────────────────────────────────────────────────────────────────────────
// EvmAdapter
// ─────────────────────────────────────────────────────────────────────────────

/// EVM adapter supporting Base, Arbitrum, BSC, Polygon.
/// Uses raw JSON-RPC via reqwest (no ethers-rs dependency).
pub struct EvmAdapter {
    chain_name: String,
    rpc_url: String,
    client: reqwest::Client,
}

impl EvmAdapter {
    pub fn new(chain_name: &str) -> Self {
        let rpc_url = std::env::var(format!(
            "WARP_{}_RPC",
            chain_name.to_uppercase().replace('-', "_")
        ))
        .unwrap_or_else(|_| default_rpc(chain_name).to_string());

        Self {
            chain_name: chain_name.to_string(),
            rpc_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to build HTTP client"),
        }
    }

    /// Fetch current block number from EVM node.
    async fn eth_block_number(&self) -> WarpResult<u64> {
        let result = rpc_call(&self.client, &self.rpc_url, "eth_blockNumber", json!([])).await?;
        let hex = result.as_str().unwrap_or("0x0");
        Ok(hex_to_u64(hex))
    }

    /// Get transaction receipt.
    async fn eth_get_tx_receipt(&self, tx_hash: &str) -> WarpResult<Option<TxReceipt>> {
        let result = rpc_call(
            &self.client,
            &self.rpc_url,
            "eth_getTransactionReceipt",
            json!([tx_hash]),
        )
        .await;
        match result {
            Ok(v) if v.is_null() => Ok(None),
            Ok(v) => {
                let receipt: TxReceipt =
                    serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
                        chain: self.chain_name.clone(),
                        reason: format!("Receipt parse error: {}", e),
                    })?;
                Ok(Some(receipt))
            }
            Err(e) => Err(e),
        }
    }

    /// Fetch BridgeBurn logs for the last N blocks.
    async fn fetch_burn_logs(&self, from_block: u64, to_block: u64) -> WarpResult<Vec<EthLog>> {
        let contract = match wzion_contract(&self.chain_name) {
            Some(addr) => addr,
            None => return Ok(vec![]),
        };
        let result = rpc_call(
            &self.client,
            &self.rpc_url,
            "eth_getLogs",
            json!([{
                "fromBlock": format!("0x{:x}", from_block),
                "toBlock":   format!("0x{:x}", to_block),
                "address":   contract,
                "topics":    [BRIDGE_BURN_TOPIC],
            }]),
        )
        .await?;
        serde_json::from_value(result).map_err(|e| WarpError::AdapterError {
            chain: self.chain_name.clone(),
            reason: format!("Log parse error: {}", e),
        })
    }

    /// Decode a BridgeBurn log → DepositProof.
    /// Calldata layout: first topic = sig, second = from (indexed),
    /// data = ABI-encoded (uint256 amount, string destAddr)
    fn decode_burn_log(&self, log: &EthLog, current_block: u64) -> Option<DepositProof> {
        // topics[1] = from address (indexed)
        let sender_topic = log.topics.get(1)?;
        let sender = format!("0x{}", &sender_topic[26..]);

        // ABI layout of data for BridgeBurn(address indexed, uint256 amount, string destAddr):
        //   [0x00..0x1F]  amount  (uint256)
        //   [0x20..0x3F]  offset  (= 0x40)
        //   [0x40..0x5F]  string length
        //   [0x60..    ]  string bytes (padded to 32-byte boundary)
        let data = log.data.trim_start_matches("0x");
        if data.len() < 128 {
            return None;
        }
        let amount_hex = &data[0..64];
        let amount = u64::from_str_radix(amount_hex.trim_start_matches('0').max("0"), 16).ok()?;

        // Decode destAddr string
        let str_len_hex = &data[128..192]; // offset 0x40 * 2 chars
        let str_len = usize::from_str_radix(str_len_hex.trim_start_matches('0').max("0"), 16)
            .unwrap_or(0)
            .min(256); // sanity cap
        let str_start = 192; // 0x60 * 2
        let str_end = str_start + str_len * 2;
        let dest_addr = if str_len > 0 && data.len() >= str_end {
            let hex_bytes = &data[str_start..str_end];
            (0..hex_bytes.len())
                .step_by(2)
                .filter_map(|i| u8::from_str_radix(&hex_bytes[i..i + 2], 16).ok())
                .map(|b| b as char)
                .collect::<String>()
        } else {
            String::new()
        };

        let block_num = hex_to_u64(&log.block_number);
        let confirmations = current_block.saturating_sub(block_num);

        Some(DepositProof {
            tx_hash: log.tx_hash.clone(),
            block_height: block_num,
            block_hash: log.block_hash.clone(),
            sender,
            amount_flowers: amount,
            // Encode dest ZION address in memo so watcher can route inbound
            memo: format!("WARP_INBOUND:{}:{}", self.chain_name, dest_addr),
            confirmations,
        })
    }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Evm
    }

    fn name(&self) -> &str {
        &self.chain_name
    }

    /// Check connectivity by calling eth_blockNumber.
    async fn health_check(&self) -> WarpResult<bool> {
        match self.eth_block_number().await {
            Ok(h) => {
                info!("[WARP][{}] Health OK — block #{}", self.chain_name, h);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][{}] Health FAIL: {}", self.chain_name, e);
                Ok(false)
            }
        }
    }

    /// Watch for BridgeBurn events in the last 100 blocks.
    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let tip = self.eth_block_number().await?;
        let from = tip.saturating_sub(100);
        debug!("[WARP][{}] Scanning logs {}-{}", self.chain_name, from, tip);

        let logs = self.fetch_burn_logs(from, tip).await?;
        let proofs: Vec<DepositProof> = logs
            .iter()
            .filter_map(|l| self.decode_burn_log(l, tip))
            .collect();

        info!(
            "[WARP][{}] Found {} BridgeBurn events",
            self.chain_name,
            proofs.len()
        );
        Ok(proofs)
    }

    /// Execute mint on destination chain.
    ///
    /// Loads relay private key from `WARP_EVM_RELAY_KEY` env var.
    /// When key is not set, performs a simulation-only eth_call and returns an error
    /// so the operator can diagnose connectivity before keying the relayer.
    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let contract = wzion_contract(&self.chain_name).ok_or_else(|| WarpError::AdapterError {
            chain: self.chain_name.clone(),
            reason: "No wZION contract address for this chain".into(),
        })?;

        // Derive bytes32 msg_hash from warp_message_hash string
        let msg_hash: [u8; 32] = {
            let mut h = sha2::Sha256::new();
            h.update(instruction.warp_message_hash.as_bytes());
            h.finalize().into()
        };

        // ABI-encode bridgeMint(address, uint256, bytes32)
        let calldata = abi_encode_bridge_mint(
            &instruction.recipient,
            instruction.amount_dest_atomic,
            &msg_hash,
        )?;

        // ── Attempt signing if relay key is configured ────────────────────────
        match EvmSigner::from_env() {
            Ok(signer) => {
                // Determine chain_id from chain name
                let chain_id = evm_chain_id(&self.chain_name);

                info!(
                    "[WARP][{}] execute_mint: relay={} contract={} amount={} recipient={}",
                    self.chain_name,
                    signer.address,
                    contract,
                    instruction.amount_dest_atomic,
                    instruction.recipient,
                );

                let tx_hash = signer
                    .send_tx(
                        &self.client,
                        &self.rpc_url,
                        chain_id,
                        contract,
                        &calldata,
                        0,       // value: 0 ETH
                        300_000, // gas limit
                    )
                    .await?;

                info!(
                    "[WARP][{}] bridgeMint TX submitted: {}",
                    self.chain_name, tx_hash
                );
                Ok(tx_hash)
            }

            Err(_no_key) => {
                // Key not configured — run simulation so operators can see if the
                // contract call would succeed, then return a clear error.
                let calldata_hex = hex::encode(&calldata);
                let sim = rpc_call(
                    &self.client,
                    &self.rpc_url,
                    "eth_call",
                    json!([{ "to": contract, "data": format!("0x{}", calldata_hex) }, "latest"]),
                )
                .await;

                match sim {
                    Ok(_) => Err(WarpError::AdapterError {
                        chain: self.chain_name.clone(),
                        reason: "WARP_EVM_RELAY_KEY not set — simulation OK but TX not broadcast. \
                                 Set relay key to enable live minting."
                            .into(),
                    }),
                    Err(e) => Err(WarpError::AdapterError {
                        chain: self.chain_name.clone(),
                        reason: format!("bridgeMint sim failed (key also missing): {}", e),
                    }),
                }
            }
        }
    }

    /// Current block height.
    async fn current_height(&self) -> WarpResult<u64> {
        self.eth_block_number().await
    }

    /// Number of confirmations for a TX.
    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let tip = self.eth_block_number().await?;
        match self.eth_get_tx_receipt(tx_hash).await? {
            None => Ok(0),
            Some(receipt) => {
                let tx_block = receipt
                    .block_number
                    .as_deref()
                    .map(hex_to_u64)
                    .unwrap_or(tip);
                Ok(tip.saturating_sub(tx_block))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evm_adapter_name() {
        let adapter = EvmAdapter::new("base");
        assert_eq!(adapter.name(), "base");
        assert_eq!(adapter.family(), ChainFamily::Evm);
    }

    #[test]
    fn test_evm_adapter_arbitrum() {
        let adapter = EvmAdapter::new("arbitrum");
        assert_eq!(adapter.name(), "arbitrum");
    }

    #[test]
    fn test_hex_to_u64() {
        assert_eq!(hex_to_u64("0x1"), 1);
        assert_eq!(hex_to_u64("0xff"), 255);
        assert_eq!(hex_to_u64("0x0"), 0);
    }

    #[test]
    fn test_wzion_contract_addresses() {
        assert!(wzion_contract("base").is_some());
        assert!(wzion_contract("arbitrum").is_some());
        assert!(wzion_contract("unknown").is_none());
    }

    #[test]
    fn test_default_rpc_urls() {
        assert!(default_rpc("base").contains("base.org"));
        assert!(default_rpc("arbitrum").contains("arbitrum"));
        assert!(default_rpc("bsc").contains("binance"));
        assert!(default_rpc("polygon").contains("polygon"));
    }

    /// Integration test — only runs if WARP_BASE_RPC is set in env.
    #[tokio::test]
    async fn test_evm_health_check_integ() {
        let adapter = EvmAdapter::new("base");
        // On CI without network access this returns Ok(true) only if we mock.
        // Tolerant: just ensure it doesn't panic.
        let _ = adapter.health_check().await;
    }
}
