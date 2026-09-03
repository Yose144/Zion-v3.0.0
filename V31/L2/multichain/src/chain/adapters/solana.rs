//! Solana adapter for the multichain wallet — SPL token deposit watching.
//!
//! Uses Solana JSON-RPC directly (no solana-client dependency).
//! Watches for SPL token transfers to derived deposit addresses by polling
//! `getSignaturesForAddress` + `getTransaction`.

use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::{debug, warn};

use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};
use sha2::{Digest, Sha256};

/// ZION SPL token mint on Solana mainnet.
const ZION_SPL_MINT: &str = "HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H";

fn default_rpc(cluster: &str) -> &'static str {
    match cluster {
        "devnet" => "https://api.devnet.solana.com",
        "testnet" => "https://api.testnet.solana.com",
        _ => "https://api.mainnet-beta.solana.com",
    }
}

/// Solana adapter for the multichain wallet.
pub struct SolanaAdapter {
    chain: ChainId,
    cluster: String,
    rpc_url: String,
    client: reqwest::Client,
    zion_mint: String,
}

impl SolanaAdapter {
    pub fn new(rpc_url: Option<&str>, zion_mint: Option<&str>) -> MultichainResult<Self> {
        let cluster = std::env::var("SOLANA_CLUSTER").unwrap_or_else(|_| "mainnet-beta".into());
        let rpc_url = rpc_url
            .map(|s| s.to_string())
            .or_else(|| std::env::var("WARP_SOLANA_RPC").ok())
            .unwrap_or_else(|| default_rpc(&cluster).to_string());

        let zion_mint = zion_mint
            .map(|s| s.to_string())
            .or_else(|| std::env::var("WARP_SOLANA_ZION_MINT").ok())
            .unwrap_or_else(|| ZION_SPL_MINT.to_string());

        Ok(Self {
            chain: ChainId::Solana,
            cluster,
            rpc_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|e| MultichainError::Config(format!("solana http client: {e}")))?,
            zion_mint,
        })
    }

    fn zion_asset(&self) -> Asset {
        Asset::with_contract(
            self.chain,
            "ZION",
            self.zion_mint.clone(),
            6,
            "ZION (SPL)",
        )
    }

    async fn rpc(&self, method: &str, params: Value) -> MultichainResult<Value> {
        let body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });
        let resp: Value = self
            .client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(format!("solana rpc {method}: {e}")))?
            .json()
            .await
            .map_err(|e| MultichainError::Internal(format!("solana rpc {method} decode: {e}")))?;

        if let Some(err) = resp.get("error") {
            return Err(MultichainError::Internal(format!(
                "solana rpc {method} error: {err}"
            )));
        }

        resp.get("result")
            .cloned()
            .ok_or_else(|| MultichainError::Internal(format!("solana rpc {method}: null result")))
    }

    /// Get current slot height.
    async fn get_slot(&self) -> MultichainResult<u64> {
        let v = self.rpc("getSlot", json!([{"commitment": "confirmed"}])).await?;
        v.as_u64()
            .ok_or_else(|| MultichainError::Internal("solana getSlot: not a number".into()))
    }

    /// Get transaction details by signature.
    async fn get_transaction(&self, sig: &str) -> MultichainResult<Option<Value>> {
        let v = self
            .rpc(
                "getTransaction",
                json!([sig, {"maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}]),
            )
            .await?;
        Ok(if v.is_null() { None } else { Some(v) })
    }

    /// Get recent signatures for an address (token account or wallet).
    async fn get_signatures_for_address(&self, address: &str, limit: usize) -> MultichainResult<Vec<SigInfo>> {
        let v = self
            .rpc("getSignaturesForAddress", json!([address, {"limit": limit}]))
            .await?;
        let sigs: Vec<SigInfo> = serde_json::from_value(v)
            .map_err(|e| MultichainError::Internal(format!("solana signatures decode: {e}")))?;
        Ok(sigs)
    }

    /// Find associated token account (ATA) for a wallet address and mint.
    async fn find_token_account(&self, wallet: &str) -> MultichainResult<Option<String>> {
        let v = self
            .rpc(
                "getTokenAccountsByOwner",
                json!([wallet, {"mint": self.zion_mint}, {"encoding": "base58"}]),
            )
            .await?;

        let accounts = v
            .get("value")
            .and_then(|a| a.as_array());

        if let Some(arr) = accounts {
            if let Some(first) = arr.first() {
                let pubkey = first
                    .get("pubkey")
                    .and_then(|p| p.as_str())
                    .map(|s| s.to_string());
                return Ok(pubkey);
            }
        }
        Ok(None)
    }

    /// Parse an SPL token transfer from a transaction's instructions.
    fn parse_spl_transfer(tx: &Value, recipient_wallet: &str) -> Option<(Amount, String)> {
        // Look for token transfer instructions in the transaction.
        let instructions = tx
            .pointer("/transaction/message/instructions")
            .and_then(|i| i.as_array())?;

        for ix in instructions {
            let program = ix.get("program").and_then(|p| p.as_str()).unwrap_or("");
            let parsed = match ix.get("parsed") {
                Some(p) => p,
                None => continue,
            };
            if program != "spl-token" {
                continue;
            }

            let ix_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if ix_type != "transfer" && ix_type != "transferChecked" {
                continue;
            }

            let info = match parsed.get("info") {
                Some(i) => i,
                None => continue,
            };
            // For "transfer", the recipient is in "destination".
            // For "transferChecked", it's also "destination".
            let dest = match info.get("destination").and_then(|d| d.as_str()) {
                Some(d) => d,
                None => continue,
            };
            let amount_str = info
                .get("amount")
                .or_else(|| info.get("tokenAmount").and_then(|t| t.get("amount")))
                .and_then(|a| a.as_str());
            let amount_str = match amount_str {
                Some(a) => a,
                None => continue,
            };
            let amount: u128 = match amount_str.parse() {
                Ok(a) => a,
                Err(_) => continue,
            };
            return Some((Amount(amount), dest.to_string()));
        }

        // Also check inner instructions (for multi-instruction transactions).
        if let Some(inner_ixs) = tx.get("meta").and_then(|m| m.get("innerInstructions")).and_then(|i| i.as_array()) {
            for inner in inner_ixs {
                if let Some(instructions) = inner.get("instructions").and_then(|i| i.as_array()) {
                    for ix in instructions {
                        let program = ix.get("program").and_then(|p| p.as_str()).unwrap_or("");
                        let parsed = match ix.get("parsed") {
                            Some(p) => p,
                            None => continue,
                        };
                        if program != "spl-token" {
                            continue;
                        }
                        let ix_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        if ix_type != "transfer" && ix_type != "transferChecked" {
                            continue;
                        }
                        let info = match parsed.get("info") {
                            Some(i) => i,
                            None => continue,
                        };
                        let dest = match info.get("destination").and_then(|d| d.as_str()) {
                            Some(d) => d,
                            None => continue,
                        };
                        let amount_str = info
                            .get("amount")
                            .or_else(|| info.get("tokenAmount").and_then(|t| t.get("amount")))
                            .and_then(|a| a.as_str());
                        let amount_str = match amount_str {
                            Some(a) => a,
                            None => continue,
                        };
                        let amount: u128 = match amount_str.parse() {
                            Ok(a) => a,
                            Err(_) => continue,
                        };
                        return Some((Amount(amount), dest.to_string()));
                    }
                }
            }
        }

        let _ = recipient_wallet; // suppress unused warning
        None
    }
}

/// Signature info from `getSignaturesForAddress`.
#[derive(Deserialize)]
struct SigInfo {
    signature: String,
    #[serde(default)]
    err: Option<Value>,
    #[serde(default)]
    slot: Option<u64>,
    #[serde(default)]
    block_time: Option<u64>,
}

#[async_trait]
impl ChainAdapter for SolanaAdapter {
    fn name(&self) -> &str {
        "solana"
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Solana
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        match self.get_slot().await {
            Ok(_) => Ok(true),
            Err(e) => {
                warn!("[multichain][solana] health check failed: {e}");
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        // Not used — deposit watching uses watch_addresses.
        Ok(Vec::new())
    }

    async fn watch_addresses(&self, addresses: &[Address]) -> MultichainResult<Vec<DepositEvent>> {
        let mut events = Vec::new();

        for addr in addresses {
            if addr.chain != self.chain {
                continue;
            }

            let wallet = &addr.encoded;
            if wallet.is_empty() {
                continue;
            }

            // Find the associated token account for this wallet.
            let token_account = match self.find_token_account(wallet).await {
                Ok(Some(ta)) => ta,
                Ok(None) => {
                    debug!("[multichain][solana] no token account for {wallet}");
                    continue;
                }
                Err(e) => {
                    warn!("[multichain][solana] find_token_account({wallet}) failed: {e}");
                    continue;
                }
            };

            // Poll recent signatures for the token account.
            let sigs = match self.get_signatures_for_address(&token_account, 20).await {
                Ok(s) => s,
                Err(e) => {
                    warn!("[multichain][solana] get_signatures({token_account}) failed: {e}");
                    continue;
                }
            };

            for sig in sigs {
                // Skip failed transactions.
                if sig.err.is_some() {
                    continue;
                }

                // Get transaction details.
                let tx = match self.get_transaction(&sig.signature).await {
                    Ok(Some(t)) => t,
                    Ok(None) => continue,
                    Err(e) => {
                        debug!("[multichain][solana] getTransaction({}) failed: {e}", sig.signature);
                        continue;
                    }
                };

                // Parse SPL transfer.
                if let Some((amount, dest_ta)) = Self::parse_spl_transfer(&tx, wallet) {
                    // Verify the destination token account matches.
                    if dest_ta != token_account {
                        continue;
                    }

                    // Solana signatures are 64-byte base58 strings.
                    // Hash to 32 bytes with SHA256 for our Hash type.
                    let sig_bytes = bs58::decode(&sig.signature).into_vec().unwrap_or_default();
                    let hash_input = if sig_bytes.is_empty() {
                        sig.signature.as_bytes().to_vec()
                    } else {
                        sig_bytes
                    };
                    let mut hasher = Sha256::new();
                    hasher.update(&hash_input);
                    let digest = hasher.finalize();
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&digest);
                    let tx_hash = Hash::new(arr);

                    events.push(DepositEvent {
                        chain: self.chain,
                        tx_hash,
                        recipient: addr.clone(),
                        amount,
                        memo: None,
                        confirmations: 1, // Solana slots are ~400ms; we use "confirmed" commitment
                        asset: Some(self.zion_asset()),
                    });
                }
            }
        }

        Ok(events)
    }

    async fn execute_outbound(&self, _transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "solana execute_outbound: not implemented yet (requires Solana signing)".to_string(),
        ))
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        self.get_slot().await
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        // We stored a SHA256 hash of the signature, so we can't recover the
        // original signature. Instead, we use the hex representation as a
        // lookup key — the caller should pass the original signature encoded
        // as hex of the SHA256 hash.
        // For now, return 1 (confirmed) since we only process confirmed txs.
        let _ = tx_hash;
        Ok(1)
    }

    async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "solana send_payment: not implemented yet".to_string(),
        ))
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        // Native SOL balance.
        let v = self
            .rpc("getBalance", json!([address.encoded, {"commitment": "confirmed"}]))
            .await?;
        let lamports = v
            .get("value")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        Ok(Amount(lamports as u128))
    }

    async fn token_balance(&self, asset: &Asset, address: &Address) -> MultichainResult<Amount> {
        // SPL token balance via getTokenAccountsByOwner.
        let mint = asset.id.contract.as_deref().unwrap_or(&self.zion_mint);
        let v = self
            .rpc(
                "getTokenAccountsByOwner",
                json!([address.encoded, {"mint": mint}, {"encoding": "jsonParsed"}]),
            )
            .await?;

        let accounts = v.get("value").and_then(|a| a.as_array());
        let mut total: u128 = 0;

        if let Some(arr) = accounts {
            for account in arr {
                let amount = account
                    .pointer("/account/data/parsed/info/tokenAmount/amount")
                    .and_then(|a| a.as_str())
                    .and_then(|s| s.parse::<u128>().ok())
                    .unwrap_or(0);
                total += amount;
            }
        }

        Ok(Amount(total))
    }
}
