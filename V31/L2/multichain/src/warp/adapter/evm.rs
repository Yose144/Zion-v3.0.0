use crate::warp::adapter::ChainAdapter;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::evm_signer::{abi_encode_bridge_mint, EvmSigner};
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Digest;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// wZION contract addresses (deployed in bridge session 15-16) & BridgeBurn topic
// ─────────────────────────────────────────────────────────────────────────────

/// Canonical `BridgeBurn` event signature (see contracts/src/evm/wZION.sol):
/// `BridgeBurn(address indexed from, uint256 amount, string l1Recipient,
///            bytes32 indexed burnId, uint256 timestamp)`
/// topics = [sig, from, burnId]; data = (amount, l1Recipient, timestamp).
fn bridge_burn_topic() -> String {
    let mut h = sha3::Keccak256::new();
    h.update(b"BridgeBurn(address,uint256,string,bytes32,uint256)");
    format!("0x{}", hex::encode(h.finalize()))
}

/// Default wZION contract address (deployed on all EVM chains in the
/// 3.0.4 bridge session — same address on every chain).
///
/// Override per-chain via `WARP_{CHAIN}_WZION_ADDR` env var.
const DEFAULT_WZION: &str = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";

#[allow(dead_code)]
fn wzion_contract(chain: &str) -> Option<String> {
    wzion_contract_with_override(chain, None)
}

fn wzion_contract_with_override(chain: &str, override_addr: Option<&str>) -> Option<String> {
    if let Some(addr) = override_addr {
        if !addr.is_empty() {
            return Some(addr.to_string());
        }
    }

    // Allow per-chain override via env var.
    let env_key = format!("WARP_{}_WZION_ADDR", chain.to_uppercase().replace('-', "_"));
    if let Ok(addr) = std::env::var(&env_key) {
        if !addr.is_empty() {
            return Some(addr);
        }
    }
    // All deployed EVM chains share the same wZION address.
    // "robinhood" maps to the deterministic CREATE@nonce0 address
    // (0x0c49…bb6) — deployer nonce 0 verified on chain 4663; the deploy
    // itself is pending operator ETH funding (Phase B).
    match chain {
        "base" | "base-sepolia" | "arbitrum" | "bsc" | "polygon" | "optimism" | "avalanche"
        | "robinhood" => Some(DEFAULT_WZION.to_string()),
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
        "optimism" => "https://mainnet.optimism.io",
        "avalanche" => "https://api.avax.network/ext/bc/C/rpc",
        "robinhood" => "https://rpc.mainnet.chain.robinhood.com",
        "robinhood-testnet" => "https://rpc.testnet.chain.robinhood.com",
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
        "optimism" => 10,
        "avalanche" => 43114,
        "robinhood" => 4663,
        "robinhood-testnet" => 46630,
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
    /// Emitting contract — needed to bind the log to the wZION contract
    /// when reading receipts (getLogs already filters server-side).
    #[serde(default)]
    address: String,
    /// `removed: true` marks a reorged-out log — never treat as evidence.
    #[serde(default)]
    removed: bool,
    topics: Vec<String>,
    data: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct TxReceipt {
    #[serde(rename = "transactionHash")]
    transaction_hash: Option<String>,
    #[serde(rename = "blockNumber")]
    block_number: Option<String>,
    #[serde(rename = "blockHash")]
    block_hash: Option<String>,
    status: Option<String>,
    #[serde(default)]
    logs: Vec<EthLog>,
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

/// Confirmations for a receipt: `status` must explicitly be `0x1` (a
/// reverted tx — `0x0` — or a missing/malformed status is not inclusion
/// evidence) and `blockNumber` must parse to a positive u64 not above the
/// tip. Convention: `tip - inclusion` (existing depth semantics).
fn receipt_confirmations(receipt: &TxReceipt, tip: u64) -> u64 {
    if receipt.status.as_deref().map(hex_to_u64) != Some(1) {
        return 0;
    }
    match receipt.block_number.as_deref().map(hex_to_u64) {
        Some(b) if b > 0 && tip >= b => tip - b,
        _ => 0,
    }
}

/// True iff `s` is canonical lowercase `0x`-prefixed hex of `hex_len` chars.
fn is_canonical_hex(s: &str, hex_len: usize) -> bool {
    let Some(h) = s.strip_prefix("0x") else {
        return false;
    };
    h.len() == hex_len && h.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Normalize a hex string to canonical lowercase `0x` form via a checked
/// decode — requires exactly `len` decoded bytes (never slices blindly).
fn canonical_hex(s: &str, len: usize) -> Option<String> {
    let bytes = hex::decode(s.strip_prefix("0x").unwrap_or(s)).ok()?;
    if bytes.len() != len {
        return None;
    }
    Some(format!("0x{}", hex::encode(bytes)))
}

/// Pure decode of a `BridgeBurn` log →
/// `(sender, gross_amount_flowers, l1_recipient, burn_id)`.
///
/// Data layout: `(uint256 amount, string l1Recipient, uint256 timestamp)`
/// — decoded with `ethers::abi` (no manual slicing). wZION amounts are
/// 18-decimal atomic units; the bridge stores gross flowers (6 decimals)
/// → `amount / 1e12`. The quotient must be positive and fit u64 — a
/// dust-only burn (< 1 flower) releases nothing.
fn decode_bridge_burn(log: &EthLog) -> Option<(String, u64, String, String)> {
    if log.topics.len() != 3 {
        return None;
    }
    if !log.topics[0].eq_ignore_ascii_case(&bridge_burn_topic()) {
        return None;
    }

    // topics[1] = indexed `from` address: a 32-byte word with the high
    // 12 bytes zeroed.
    let from_word = hex::decode(log.topics[1].trim_start_matches("0x")).ok()?;
    if from_word.len() != 32 || from_word[..12].iter().any(|b| *b != 0) {
        return None;
    }
    let sender = format!("0x{}", hex::encode(&from_word[12..]));

    // topics[2] = indexed `burnId` bytes32.
    let burn_word = hex::decode(log.topics[2].trim_start_matches("0x")).ok()?;
    if burn_word.len() != 32 {
        return None;
    }
    let burn_id = format!("0x{}", hex::encode(burn_word));

    let data = hex::decode(log.data.trim_start_matches("0x")).ok()?;
    let decoded = ethers::core::abi::decode(
        &[
            ethers::core::abi::ParamType::Uint(256),
            ethers::core::abi::ParamType::String,
            ethers::core::abi::ParamType::Uint(256),
        ],
        &data,
    )
    .ok()?;
    let amount_wei = match decoded.first() {
        Some(ethers::core::abi::Token::Uint(u)) => *u,
        _ => return None,
    };
    let l1_recipient = match decoded.get(1) {
        Some(ethers::core::abi::Token::String(s)) => s.clone(),
        _ => return None,
    };

    let flowers = amount_wei / ethers::core::types::U256::from(1_000_000_000_000u64);
    if flowers.is_zero() || flowers > ethers::core::types::U256::from(u64::MAX) {
        return None;
    }
    Some((sender, flowers.as_u64(), l1_recipient, burn_id))
}

// ─────────────────────────────────────────────────────────────────────────────
// EvmAdapter
// ─────────────────────────────────────────────────────────────────────────────

/// EVM adapter supporting Base, Arbitrum, BSC, Polygon.
/// Uses raw JSON-RPC via reqwest (no ethers-rs dependency).
pub struct EvmAdapter {
    chain_name: String,
    rpc_url: String,
    wzion_override: Option<String>,
    client: reqwest::Client,
}

impl EvmAdapter {
    pub fn new(chain_name: &str) -> Self {
        Self::new_with_config(chain_name, None, None)
    }

    pub fn new_with_config(
        chain_name: &str,
        rpc_url_override: Option<&str>,
        wzion_addr_override: Option<&str>,
    ) -> Self {
        let rpc_url = if let Some(url) = rpc_url_override {
            if !url.is_empty() {
                url.to_string()
            } else {
                Self::resolve_rpc_url(chain_name)
            }
        } else {
            Self::resolve_rpc_url(chain_name)
        };

        let wzion_override = wzion_addr_override
            .filter(|a| !a.is_empty())
            .map(|a| a.to_string());

        Self {
            chain_name: chain_name.to_string(),
            rpc_url,
            wzion_override,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to build HTTP client"),
        }
    }

    fn resolve_rpc_url(chain_name: &str) -> String {
        std::env::var(format!(
            "WARP_{}_RPC",
            chain_name.to_uppercase().replace('-', "_")
        ))
        .unwrap_or_else(|_| default_rpc(chain_name).to_string())
    }

    fn wzion_addr(&self) -> Option<String> {
        wzion_contract_with_override(&self.chain_name, self.wzion_override.as_deref())
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
        let contract = match self.wzion_addr() {
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
                "topics":    [bridge_burn_topic()],
            }]),
        )
        .await?;
        serde_json::from_value(result).map_err(|e| WarpError::AdapterError {
            chain: self.chain_name.clone(),
            reason: format!("Log parse error: {}", e),
        })
    }

    /// Decode a BridgeBurn log → DepositProof.
    /// Requires the log to come from the configured wZION contract, not be
    /// reorg-removed, and to match the canonical event signature; the
    /// payload is decoded via `ethers::abi` (see `decode_bridge_burn`).
    fn decode_burn_log(&self, log: &EthLog, current_block: u64) -> Option<DepositProof> {
        let contract = self.wzion_addr()?;
        if !log.address.eq_ignore_ascii_case(&contract) || log.removed {
            return None;
        }
        let (sender, amount, l1_recipient, burn_id) = decode_bridge_burn(log)?;

        let block_num = hex_to_u64(&log.block_number);
        if block_num == 0 {
            return None;
        }
        let confirmations = current_block.saturating_sub(block_num);

        Some(DepositProof {
            tx_hash: canonical_hex(&log.tx_hash, 32)?,
            block_height: block_num,
            block_hash: canonical_hex(&log.block_hash, 32)?,
            sender,
            amount_flowers: amount,
            // Encode dest ZION address in memo so watcher can route inbound
            memo: format!("WARP_INBOUND:{}:{}", self.chain_name, l1_recipient),
            confirmations,
            burn_id: Some(burn_id),
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
        let contract = self.wzion_addr().ok_or_else(|| WarpError::AdapterError {
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
                        &contract,
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
        let receipt = match self.eth_get_tx_receipt(tx_hash).await? {
            Some(r) => r,
            None => return Ok(0),
        };
        let tip = self.eth_block_number().await?;
        Ok(receipt_confirmations(&receipt, tip))
    }

    /// Burn authenticity gate (FIND — inbound authorization):
    /// verifies an authoritative successful receipt for the stored
    /// `source_tx_hash`, that a `BridgeBurn` log from the configured
    /// wZION contract carries exactly the stored sender/gross-amount/
    /// burn_id and recipient, and that inclusion finality is met.
    /// Any mismatch is `Err` — a hold, never a silent pass.
    async fn verify_burn(&self, transfer: &crate::warp::types::WarpTransfer) -> WarpResult<()> {
        let err = |reason: String| WarpError::AdapterError {
            chain: self.chain_name.clone(),
            reason,
        };

        // The stored identities feed the L1 replay key
        // (`chain:burn_id:tx_hash`) and the release parameters — they must
        // already be in canonical form. A legacy/noncanonical record is an
        // operator-recovery hold, not something to re-derive silently.
        let tx_hash = transfer
            .source_tx_hash
            .as_deref()
            .filter(|h| is_canonical_hex(h, 64))
            .ok_or_else(|| err("missing or noncanonical source_tx_hash".into()))?;
        let burn_id = transfer
            .burn_id
            .as_deref()
            .filter(|h| is_canonical_hex(h, 64))
            .ok_or_else(|| err("missing or noncanonical burn_id".into()))?;
        if !is_canonical_hex(&transfer.sender, 40) {
            return Err(err("noncanonical sender address".into()));
        }
        let contract = self
            .wzion_addr()
            .ok_or_else(|| err("no wZION contract configured for this chain".into()))?;

        let receipt = self
            .eth_get_tx_receipt(tx_hash)
            .await?
            .ok_or_else(|| err("no receipt for source tx".into()))?;

        // The receipt must be for exactly the requested transaction.
        if receipt
            .transaction_hash
            .as_deref()
            .map(|h| h.eq_ignore_ascii_case(tx_hash))
            != Some(true)
        {
            return Err(err("receipt transactionHash mismatch".into()));
        }
        if receipt.status.as_deref().map(|s| hex_to_u64(s) == 1) != Some(true) {
            return Err(err("source tx missing or reverted on-chain".into()));
        }
        let block_num = receipt
            .block_number
            .as_deref()
            .map(hex_to_u64)
            .filter(|b| *b > 0)
            .ok_or_else(|| err("receipt has no valid blockNumber".into()))?;
        let block_hash = receipt
            .block_hash
            .as_deref()
            .filter(|h| is_canonical_hex(h, 64))
            .ok_or_else(|| err("receipt has no canonical blockHash".into()))?;

        // Inclusion finality comes from the chain, not from the
        // client-supplied `transfer.confirmations` field.
        let tip = self.eth_block_number().await?;
        let required = transfer.source_chain.finality_blocks.max(1);
        let confs = tip.saturating_sub(block_num);
        if tip < block_num || confs < required {
            return Err(WarpError::FinalityNotReached {
                chain: self.chain_name.clone(),
                confirmations: confs,
                required,
            });
        }

        // Scan ALL burn logs from the configured contract — one tx may
        // carry several burns (distinct burn_ids); only a decoded event
        // matching this transfer's fields authorizes it.
        for log in &receipt.logs {
            if log.removed || !log.address.eq_ignore_ascii_case(&contract) {
                continue;
            }
            if !log.tx_hash.eq_ignore_ascii_case(tx_hash)
                || !log.block_hash.eq_ignore_ascii_case(block_hash)
                || hex_to_u64(&log.block_number) != block_num
            {
                return Err(err("burn log tx/block does not match receipt".into()));
            }
            let Some((sender, amount, recipient, burn)) = decode_bridge_burn(log) else {
                continue;
            };
            if sender == transfer.sender
                && amount == transfer.amount_flowers
                && burn == burn_id
                && recipient == transfer.recipient
                && format!("WARP_INBOUND:{}:{}", self.chain_name, recipient) == transfer.memo
            {
                return Ok(());
            }
        }
        Err(err("no BridgeBurn event matching this transfer".into()))
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
        // All deployed EVM chains should return the real wZION address.
        assert!(wzion_contract("base").is_some());
        assert_eq!(
            wzion_contract("base").unwrap(),
            "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"
        );
        assert!(wzion_contract("bsc").is_some());
        assert_eq!(
            wzion_contract("bsc").unwrap(),
            "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"
        );
        assert!(wzion_contract("arbitrum").is_some());
        assert!(wzion_contract("polygon").is_some());
        assert!(wzion_contract("optimism").is_some());
        assert!(wzion_contract("avalanche").is_some());
        assert_eq!(
            wzion_contract("robinhood").unwrap(),
            "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"
        );
        assert!(wzion_contract("unknown").is_none());
    }

    #[test]
    fn test_default_rpc_urls() {
        assert!(default_rpc("base").contains("base.org"));
        assert!(default_rpc("arbitrum").contains("arbitrum"));
        assert!(default_rpc("bsc").contains("binance"));
        assert!(default_rpc("polygon").contains("polygon"));
        assert!(default_rpc("optimism").contains("optimism"));
        assert!(default_rpc("avalanche").contains("avax"));
        assert!(default_rpc("robinhood").contains("robinhood"));
        assert!(default_rpc("robinhood-testnet").contains("testnet"));
    }

    #[test]
    fn test_evm_chain_ids() {
        assert_eq!(evm_chain_id("base"), 8453);
        assert_eq!(evm_chain_id("base-sepolia"), 84532);
        assert_eq!(evm_chain_id("arbitrum"), 42161);
        assert_eq!(evm_chain_id("bsc"), 56);
        assert_eq!(evm_chain_id("polygon"), 137);
        assert_eq!(evm_chain_id("optimism"), 10);
        assert_eq!(evm_chain_id("avalanche"), 43114);
        assert_eq!(evm_chain_id("robinhood"), 4663);
        assert_eq!(evm_chain_id("robinhood-testnet"), 46630);
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

#[cfg(test)]
pub(crate) mod audit_tests {
    use super::*;
    use ethers::core::abi::{encode, Token};

    pub(super) fn burn_log(
        data: Vec<u8>,
        from: &str,
        burn: &str,
        addr: &str,
        removed: bool,
        topic: &str,
    ) -> EthLog {
        EthLog {
            tx_hash: "0x".to_string() + &"a".repeat(64),
            block_number: "0x64".into(),
            block_hash: "0x".to_string() + &"b".repeat(64),
            address: addr.into(),
            removed,
            topics: vec![topic.into(), from.into(), burn.into()],
            data: format!("0x{}", hex::encode(data)),
        }
    }
    pub(crate) const FROM: &str =
        "0x0000000000000000000000001111111111111111111111111111111111111111";
    pub(crate) const BURN: &str =
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

    pub(crate) fn burn_data(amount: u64, recipient: &str, ts: u64) -> Vec<u8> {
        encode(&[
            Token::Uint(amount.into()),
            Token::String(recipient.into()),
            Token::Uint(ts.into()),
        ])
    }

    #[test]
    fn bridge_burn_decodes_canonical_event() {
        // 1e18 wZION = 1_000_000 flowers (1 ZION)
        let log = burn_log(
            burn_data(1_000_000_000_000_000_000, "zion1dest", 9),
            FROM,
            BURN,
            DEFAULT_WZION,
            false,
            &bridge_burn_topic(),
        );
        let (sender, amount, recip, burn) = decode_bridge_burn(&log).unwrap();
        assert_eq!(sender, "0x1111111111111111111111111111111111111111");
        assert_eq!(amount, 1_000_000);
        assert_eq!(recip, "zion1dest");
        assert_eq!(burn, BURN);
    }

    #[test]
    fn bridge_burn_rejects_table() {
        let good_data = burn_data(2_000_000_000_000_000_000, "zion1r", 1);
        let topic = bridge_burn_topic();
        // wrong topic / removed / wrong topics count
        assert!(decode_bridge_burn(&burn_log(
            good_data.clone(),
            FROM,
            BURN,
            DEFAULT_WZION,
            false,
            "0x00"
        ))
        .is_none());
        let mut t3 = burn_log(good_data.clone(), FROM, BURN, DEFAULT_WZION, false, &topic);
        t3.topics.pop();
        assert!(decode_bridge_burn(&t3).is_none());
        // malformed sender topic (high 12 bytes nonzero / short)
        assert!(decode_bridge_burn(&burn_log(
            good_data.clone(),
            &("0x".to_string() + &"f".repeat(64)),
            BURN,
            DEFAULT_WZION,
            false,
            &topic
        ))
        .is_none());
        assert!(decode_bridge_burn(&burn_log(
            good_data.clone(),
            "0x1234",
            BURN,
            DEFAULT_WZION,
            false,
            &topic
        ))
        .is_none());
        // oversized amount (> u64::MAX flowers) and dust-only (< 1e12)
        let big_data = encode(&[
            Token::Uint(ethers::core::types::U256::MAX),
            Token::String("z".into()),
            Token::Uint(0u64.into()),
        ]);
        assert!(decode_bridge_burn(&burn_log(
            big_data,
            FROM,
            BURN,
            DEFAULT_WZION,
            false,
            &topic
        ))
        .is_none());
        assert!(decode_bridge_burn(&burn_log(
            burn_data(999_999_999_999, "z", 0),
            FROM,
            BURN,
            DEFAULT_WZION,
            false,
            &topic
        ))
        .is_none());
        // truncated/malformed data — incl. old unchecked-slice panic window
        for hexlen in [0usize, 2, 62, 64, 128, 129, 190, 191] {
            let mut l = burn_log(
                vec![0u8; hexlen / 2],
                FROM,
                BURN,
                DEFAULT_WZION,
                false,
                &topic,
            );
            if hexlen % 2 == 1 {
                l.data = format!("0x{}", "0".repeat(hexlen));
            }
            assert!(decode_bridge_burn(&l).is_none(), "hexlen {hexlen}");
        }
    }

    #[test]
    fn receipt_confirmations_table() {
        let r = |status: Option<&str>, bn: Option<&str>| TxReceipt {
            transaction_hash: None,
            block_number: bn.map(|s| s.into()),
            block_hash: None,
            status: status.map(|s| s.into()),
            logs: vec![],
        };
        assert_eq!(receipt_confirmations(&r(Some("0x1"), Some("0x5f")), 100), 5);
        for x in [
            r(Some("0x0"), Some("0x5f")), // reverted
            r(None, Some("0x5f")),        // missing status
            r(Some("0x1"), None),         // missing block
            r(Some("0x1"), Some("0x0")),  // zero block
            r(Some("0x1"), Some("0x7f")), // future block > tip(100)
            r(Some("garbage"), Some("0x5f")),
        ] {
            assert_eq!(receipt_confirmations(&x, 100), 0);
        }
    }

    // Minimal JSON-RPC mock: answers eth_getTransactionReceipt +
    // eth_blockNumber with canned bodies.
    /// Minimal JSON-RPC mock: answers `eth_getTransactionReceipt` and
    /// `eth_blockNumber` with canned bodies. Reads the FULL request body
    /// (Content-Length aware) before responding; the listener lives on
    /// the test runtime and is dropped with it.
    pub(crate) async fn spawn_rpc(receipt: String, tip: String) -> String {
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        let receipt = std::sync::Arc::new(receipt);
        let tip = std::sync::Arc::new(tip);
        tokio::spawn(async move {
            loop {
                let Ok((mut s, _)) = l.accept().await else {
                    break;
                };
                let (receipt, tip) = (receipt.clone(), tip.clone());
                tokio::spawn(async move {
                    use tokio::io::{AsyncReadExt, AsyncWriteExt};
                    let mut buf = Vec::with_capacity(8192);
                    let mut chunk = [0u8; 4096];
                    loop {
                        let n = s.read(&mut chunk).await.unwrap_or(0);
                        if n == 0 {
                            break;
                        }
                        buf.extend_from_slice(&chunk[..n]);
                        let txt = String::from_utf8_lossy(&buf);
                        let Some(hp) = txt.find("\r\n\r\n") else {
                            continue;
                        };
                        let clen: usize = txt[..hp]
                            .lines()
                            .find_map(|l| {
                                l.trim()
                                    .to_ascii_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|v| v.trim().parse().ok())
                            })
                            .unwrap_or(0);
                        if buf.len() >= hp + 4 + clen {
                            break;
                        }
                    }
                    let req = String::from_utf8_lossy(&buf);
                    let body = if req.contains("eth_blockNumber") {
                        tip
                    } else {
                        receipt
                    };
                    let r = format!("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", body.len(), body);
                    let _ = s.write_all(r.as_bytes()).await;
                });
            }
        });
        format!("http://127.0.0.1:{port}")
    }

    #[tokio::test]
    async fn confirmations_mock_rpc_end_to_end() {
        let receipt = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"0x1","blockNumber":"0x5f","transactionHash":"0xabc"}}"#;
        let tip = r#"{"jsonrpc":"2.0","id":1,"result":"0x64"}"#;
        let url = spawn_rpc(receipt.to_string(), tip.to_string()).await;
        let a = EvmAdapter::new_with_config("base", Some(&url), None);
        assert_eq!(a.confirmations("0xabc").await.unwrap(), 5);
        let reverted = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"0x0","blockNumber":"0x5f"}}"#;
        let a2 = EvmAdapter::new_with_config(
            "base",
            Some(&spawn_rpc(reverted.to_string(), tip.to_string()).await),
            None,
        );
        assert_eq!(a2.confirmations("0xabc").await.unwrap(), 0);
    }

    pub(crate) fn burn_log_json(
        txh: &str,
        block: &str,
        addr: &str,
        removed: bool,
        from: &str,
        burn: &str,
        data: &[u8],
    ) -> String {
        format!(
            r#"{{"transactionHash":"{txh}","blockNumber":"{block}","blockHash":"0x{bh}","address":"{addr}","removed":{removed},"topics":["{topic}","{from}","{burn}"],"data":"0x{data}"}}"#,
            bh = "b".repeat(64),
            topic = bridge_burn_topic(),
            data = hex::encode(data)
        )
    }

    pub(crate) fn receipt_json(txh: &str, block: &str, status: &str, logs: &[String]) -> String {
        format!(
            r#"{{"jsonrpc":"2.0","id":1,"result":{{"transactionHash":"{txh}","blockNumber":"{block}","blockHash":"0x{bh}","status":"{status}","logs":[{}]}}}}"#,
            logs.join(","),
            bh = "b".repeat(64)
        )
    }

    pub(crate) fn inbound_transfer(
        txh: &str,
        sender: &str,
        burn: &str,
        amount: u64,
        recipient: &str,
    ) -> crate::warp::types::WarpTransfer {
        let mut t = crate::warp::types::WarpTransfer::new(
            crate::warp::types::ChainId::evm("base", 8453, 1),
            crate::warp::types::ChainId::zion_l1(),
            sender.into(),
            recipient.into(),
            amount,
            0,
            format!("WARP_INBOUND:base:{recipient}"),
        );
        t.source_tx_hash = Some(txh.into());
        t.burn_id = Some(burn.into());
        t
    }

    #[tokio::test]
    async fn verify_burn_mock_rpc() {
        let txh = format!("0x{}", "a".repeat(64));
        let sender = format!("0x{}", "1".repeat(40));
        let from_topic = format!("0x{}{}", "0".repeat(24), "1".repeat(40));
        let data = burn_data(1_000_000_000_000_000_000, "zion1dest", 9);
        let good_log = burn_log_json(&txh, "0x64", DEFAULT_WZION, false, &from_topic, BURN, &data);
        let good = receipt_json(&txh, "0x64", "0x1", &[good_log]);
        let tip = r#"{"jsonrpc":"2.0","id":1,"result":"0x70"}"#;
        let url = spawn_rpc(good, tip.to_string()).await;
        let a = EvmAdapter::new_with_config("base", Some(&url), None);
        let t = inbound_transfer(&txh, &sender, BURN, 1_000_000, "zion1dest");
        assert!(a.verify_burn(&t).await.is_ok());

        // Mutated recipient / amount / burn_id / source hash / sender all fail.
        let mut bad_recipient = t.clone();
        bad_recipient.recipient = "zion1other".into();
        bad_recipient.memo = "WARP_INBOUND:base:zion1other".into();
        let mut bad_amount = t.clone();
        bad_amount.amount_flowers += 1;
        let mut bad_burn = t.clone();
        bad_burn.burn_id = Some(format!("0x{}", "d".repeat(64)));
        let mut bad_sender = t.clone();
        bad_sender.sender = format!("0x{}", "2".repeat(40));
        let mut bad_hash = t.clone();
        bad_hash.source_tx_hash = Some(format!("0x{}", "e".repeat(64)));
        for m in [bad_recipient, bad_amount, bad_burn, bad_sender, bad_hash] {
            assert!(a.verify_burn(&m).await.is_err());
        }
        let _ = data;
    }

    #[tokio::test]
    async fn verify_burn_rejects_wrong_case_and_no_burn() {
        let txh = format!("0x{}", "a".repeat(64));
        // Receipt for an unrelated confirmed tx (no burn log)
        let receipt = format!(
            r#"{{"jsonrpc":"2.0","id":1,"result":{{"transactionHash":"{txh}","blockNumber":"0x64","blockHash":"0x{}","status":"0x1","logs":[]}}}}"#,
            "b".repeat(64)
        );
        let tip = r#"{"jsonrpc":"2.0","id":1,"result":"0x70"}"#;
        let url = spawn_rpc(receipt, tip.to_string()).await;
        let a = EvmAdapter::new_with_config("base", Some(&url), None);
        let t = inbound_transfer(
            &txh,
            &format!("0x{}", "1".repeat(40)),
            BURN,
            1_000_000,
            "zion1dest",
        );
        assert!(a.verify_burn(&t).await.is_err());
        // Case-variant replay identity → hold
        let mut t2 = t.clone();
        t2.source_tx_hash = Some(txh.to_uppercase().replace("0X", "0x"));
        t2.source_tx_hash = Some(format!("0x{}", "A".repeat(64)));
        assert!(a.verify_burn(&t2).await.is_err());
    }
}

#[cfg(test)]
mod audit2_tests {
    use super::audit_tests::*;
    use super::*;

    #[test]
    fn decode_burn_log_enforces_contract_and_removed() {
        let adapter = EvmAdapter::new_with_config("base", Some("http://127.0.0.1:1"), None);
        let topic = bridge_burn_topic();
        let data = burn_data(2_000_000_000_000_000_000, "zion1r", 1);
        let good = burn_log(data.clone(), FROM, BURN, DEFAULT_WZION, false, &topic);
        assert!(adapter.decode_burn_log(&good, 200).is_some());
        let wrong = burn_log(
            data.clone(),
            FROM,
            BURN,
            "0x0000000000000000000000000000000000000bad",
            false,
            &topic,
        );
        assert!(adapter.decode_burn_log(&wrong, 200).is_none());
        let rem = burn_log(data, FROM, BURN, DEFAULT_WZION, true, &topic);
        assert!(adapter.decode_burn_log(&rem, 200).is_none());
    }

    /// One tx may carry several BridgeBurn events — a non-matching one
    /// must not poison the receipt; only an exact match authorizes.
    #[tokio::test]
    async fn verify_burn_scans_multiple_burns() {
        let txh = format!("0x{}", "a".repeat(64));
        let sender = format!("0x{}", "1".repeat(40));
        let from_topic = format!("0x{}{}", "0".repeat(24), "1".repeat(40));
        let other_from = format!("0x{}{}", "0".repeat(24), "9".repeat(40));
        let other_burn = format!("0x{}", "e".repeat(64));
        let tip = r#"{"jsonrpc":"2.0","id":1,"result":"0x70"}"#.to_string();
        let other = burn_log_json(
            &txh,
            "0x64",
            DEFAULT_WZION,
            false,
            &other_from,
            &other_burn,
            &burn_data(9_000_000_000_000_000_000, "zion1other", 1),
        );
        let mine = burn_log_json(
            &txh,
            "0x64",
            DEFAULT_WZION,
            false,
            &from_topic,
            BURN,
            &burn_data(1_000_000_000_000_000_000, "zion1dest", 9),
        );
        let t = inbound_transfer(&txh, &sender, BURN, 1_000_000, "zion1dest");
        async fn verify(
            receipt: String,
            tip: String,
            t: &crate::warp::types::WarpTransfer,
        ) -> Result<(), crate::warp::error::WarpError> {
            let url = spawn_rpc(receipt, tip).await;
            EvmAdapter::new_with_config("base", Some(&url), None)
                .verify_burn(t)
                .await
        }

        // First burn belongs to a different transfer, second matches → Ok.
        assert!(verify(
            receipt_json(&txh, "0x64", "0x1", &[other.clone(), mine.clone()]),
            tip.clone(),
            &t
        )
        .await
        .is_ok());
        // No matching burn → hold.
        assert!(
            verify(receipt_json(&txh, "0x64", "0x1", &[other]), tip.clone(), &t)
                .await
                .is_err()
        );
        // Log block_number disagreeing with the receipt → hold.
        let wrong_blk = burn_log_json(
            &txh,
            "0x65",
            DEFAULT_WZION,
            false,
            &from_topic,
            BURN,
            &burn_data(1_000_000_000_000_000_000, "zion1dest", 9),
        );
        assert!(verify(
            receipt_json(&txh, "0x64", "0x1", &[wrong_blk]),
            tip.clone(),
            &t
        )
        .await
        .is_err());
        // Burn from a different contract → ignored → hold.
        let wrong_ct = burn_log_json(
            &txh,
            "0x64",
            "0x0000000000000000000000000000000000000bad",
            false,
            &from_topic,
            BURN,
            &burn_data(1_000_000_000_000_000_000, "zion1dest", 9),
        );
        assert!(verify(
            receipt_json(&txh, "0x64", "0x1", &[wrong_ct]),
            tip.clone(),
            &t
        )
        .await
        .is_err());
        // Reorg-removed burn → ignored → hold.
        let removed = burn_log_json(
            &txh,
            "0x64",
            DEFAULT_WZION,
            true,
            &from_topic,
            BURN,
            &burn_data(1_000_000_000_000_000_000, "zion1dest", 9),
        );
        assert!(
            verify(receipt_json(&txh, "0x64", "0x1", &[removed]), tip, &t)
                .await
                .is_err()
        );
    }
}
