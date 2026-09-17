use crate::warp::adapter::ChainAdapter;
use crate::warp::btc_htlc::{extract_preimage, BtcHtlc};
use crate::warp::btc_signer::BtcSigner;
use crate::warp::config::ChainConfig;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use bitcoin::Network;
use bitcoin::Witness;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// HTLC watch address & OP_RETURN prefix
// ─────────────────────────────────────────────────────────────────────────────
const WARP_OP_RETURN_PREFIX: &str = "WARP_INBOUND:bitcoin:";
// OP_RETURN data is hex-encoded — we look for the prefix in decoded ASCII.

fn htlc_address_with_override(network: &str, htlc_override: Option<&str>) -> Option<String> {
    if let Some(addr) = htlc_override {
        if !addr.is_empty() {
            return Some(addr.to_string());
        }
    }
    if let Ok(addr) = std::env::var("WARP_BITCOIN_HTLC_ADDRESS") {
        if !addr.is_empty() {
            return Some(addr);
        }
    }
    match network {
        "mainnet" => {
            warn!(
                "[WARP][bitcoin] mainnet HTLC address is a placeholder — update after deployment"
            );
            Some("bc1qzionhtlcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".to_string())
        }
        "testnet" => {
            warn!("[WARP][bitcoin] testnet HTLC address is a placeholder");
            Some("tb1qzionhtlctest0000000000000000000000000000".to_string())
        }
        _ => None,
    }
}

#[allow(dead_code)]
fn htlc_address(network: &str) -> Option<String> {
    htlc_address_with_override(network, None)
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
    scriptpubkey: Option<String>,
    scriptpubkey_type: Option<String>,
    scriptpubkey_asm: Option<String>,
    scriptpubkey_address: Option<String>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MempoolVin {
    /// Txid of the outpoint being spent.
    txid: Option<String>,
    /// Vout index of the outpoint being spent.
    vout: Option<u32>,
    prevout: Option<MempoolVout>,
    scriptsig_asm: Option<String>,
    witness: Option<Vec<String>>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-swap HTLC detection (WARP Beta)
// ─────────────────────────────────────────────────────────────────────────────

/// A confirmed (or mempool) funding output paying into a per-swap P2WSH HTLC.
#[derive(Debug, Clone)]
pub struct BtcHtlcLock {
    pub txid: String,
    pub vout: u32,
    pub value_sats: u64,
    pub confirmations: u64,
    pub block_height: u64,
}

/// A spend of the HTLC funding outpoint — claim reveals the preimage,
/// refund returns funds to the locker after CLTV expiry.
#[derive(Debug, Clone)]
pub enum BtcHtlcSpend {
    Claim { txid: String, preimage: [u8; 32] },
    Refund { txid: String },
}

/// Scan `txs` (as returned by mempool.space `/address/{addr}/txs`) for the
/// best-confirmed output paying at least `min_sats` to `want_spk` (hex
/// scriptPubKey). Returns the candidate regardless of confirmation depth;
/// callers decide the required `min_confs`.
fn find_lock_output(
    txs: &[MempoolTx],
    want_spk: &str,
    min_sats: u64,
    tip: u64,
) -> Option<BtcHtlcLock> {
    let mut best: Option<BtcHtlcLock> = None;
    for tx in txs {
        let Some(status) = &tx.status else { continue };
        if !status.confirmed {
            continue;
        }
        let block_height = status.block_height.unwrap_or(0);
        let confirmations = tip.saturating_sub(block_height) + 1;
        for (i, v) in tx.vout.iter().flatten().enumerate() {
            if v.scriptpubkey.as_deref() == Some(want_spk) && v.value >= min_sats {
                let cand = BtcHtlcLock {
                    txid: tx.txid.clone(),
                    vout: i as u32,
                    value_sats: v.value,
                    confirmations,
                    block_height,
                };
                if best
                    .as_ref()
                    .map(|b| confirmations > b.confirmations)
                    .unwrap_or(true)
                {
                    best = Some(cand);
                }
            }
        }
    }
    best
}

/// Scan `txs` for a transaction spending the `lock` outpoint. If the witness
/// carries our exact HTLC script on the claim branch, extract the preimage;
/// a spend through the else-branch (or an unparseable witness) is a refund.
fn classify_htlc_spend(txs: &[MempoolTx], lock: &BtcHtlcLock, htlc: &BtcHtlc) -> Option<BtcHtlcSpend> {
    for tx in txs {
        for vin in tx.vin.iter().flatten() {
            if vin.txid.as_deref() == Some(lock.txid.as_str()) && vin.vout == Some(lock.vout) {
                let items: Vec<Vec<u8>> = vin
                    .witness
                    .iter()
                    .flatten()
                    .filter_map(|h| hex::decode(h).ok())
                    .collect();
                let witness = Witness::from_slice(&items);
                // Only accept a claim if the revealed script is *our* HTLC
                // script and the preimage really opens our hashlock.
                let our_script = items.last().map(|s| s.as_slice())
                    == Some(htlc.witness_script.as_bytes());
                if our_script {
                    if let Some(preimage) = extract_preimage(&witness) {
                        if Sha256::digest(preimage)[..] == htlc.hashlock[..] {
                            return Some(BtcHtlcSpend::Claim {
                                txid: tx.txid.clone(),
                                preimage,
                            });
                        }
                    }
                }
                return Some(BtcHtlcSpend::Refund {
                    txid: tx.txid.clone(),
                });
            }
        }
    }
    None
}


/// Bitcoin adapter — HTLC watch + OP_RETURN memo parsing via mempool.space API.
pub struct BitcoinAdapter {
    network: String,
    api_url: String,
    client: reqwest::Client,
    htlc_override: Option<String>,
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
            htlc_override: None,
        }
    }

    pub fn from_config(cfg: &ChainConfig) -> Self {
        let mut adapter = Self::new();
        if !cfg.rpc_url.is_empty() {
            adapter.api_url = cfg.rpc_url.clone();
        }
        if let Some(addr) = &cfg.contract_address {
            if !addr.is_empty() {
                adapter.htlc_override = Some(addr.clone());
            }
        }
        adapter
    }

    /// The mempool.space-compatible API base URL this adapter polls.
    pub fn api_url(&self) -> &str {
        &self.api_url
    }

    /// Shared HTTP client (used by the swap flow for signer broadcasts).
    pub fn client(&self) -> &reqwest::Client {
        &self.client
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

    /// Detect a funding output paying `min_sats` to the per-swap HTLC
    /// address. Returns the best-confirmed candidate (or `None`).
    /// Callers compare `confirmations` against their required depth.
    pub async fn detect_htlc_lock(
        &self,
        htlc: &BtcHtlc,
        min_sats: u64,
    ) -> WarpResult<Option<BtcHtlcLock>> {
        let tip = self.get_tip_height().await?;
        let txs = self.get_address_txs(&htlc.address.to_string()).await?;
        let want_spk = hex::encode(htlc.address.script_pubkey().as_bytes());
        Ok(find_lock_output(&txs, &want_spk, min_sats, tip))
    }

    /// Detect a spend of a previously seen HTLC lock. A claim-path spend
    /// yields the revealed preimage (verified against `htlc.hashlock` and
    /// the exact witness script); anything else is treated as a refund.
    pub async fn detect_htlc_spend(
        &self,
        htlc: &BtcHtlc,
        lock: &BtcHtlcLock,
    ) -> WarpResult<Option<BtcHtlcSpend>> {
        let txs = self.get_address_txs(&htlc.address.to_string()).await?;
        Ok(classify_htlc_spend(&txs, lock, htlc))
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
        // Guard: refuse to report healthy if the HTLC watch address is not configured
        // or is still the placeholder string.
        let htlc = match htlc_address_with_override(&self.network, self.htlc_override.as_deref()) {
            Some(addr) if !addr.contains("zionhtlc") && !addr.is_empty() => addr,
            _ => {
                warn!("[WARP][bitcoin] Health FAIL: no real HTLC address configured (set WARP_BITCOIN_HTLC_ADDRESS or chain.contract_address)");
                return Ok(false);
            }
        };

        match self.get_tip_height().await {
            Ok(h) => {
                info!("[WARP][bitcoin] Health OK — block #{} (HTLC: {})", h, htlc);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][bitcoin] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let address = match htlc_address_with_override(&self.network, self.htlc_override.as_deref())
        {
            Some(a) if !a.contains("zionhtlc") && !a.is_empty() => a,
            _ => {
                debug!("[WARP][bitcoin] No real HTLC address configured; skipping watch");
                return Ok(vec![]);
            }
        };
        let tip = self.get_tip_height().await?;
        let txs = self.get_address_txs(&address).await?;
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
                    scriptpubkey: None,
                    scriptpubkey_type: Some("p2wpkh".into()),
                    scriptpubkey_asm: None,
                    scriptpubkey_address: None,
                },
                MempoolVout {
                    value: 0,
                    scriptpubkey: None,
                    scriptpubkey_type: Some("op_return".into()),
                    scriptpubkey_asm: Some(format!("OP_RETURN OP_PUSHBYTES_38 {}", hex_memo)),
                    scriptpubkey_address: None,
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

    // ── Per-swap HTLC detection tests ────────────────────────────────────

    fn test_htlc() -> (BtcHtlc, [u8; 32]) {
        use bitcoin::secp256k1::{Secp256k1, SecretKey};
        use bitcoin::PrivateKey;
        let preimage = [0x42u8; 32];
        let hashlock: [u8; 32] = Sha256::digest(preimage).into();
        let secp = Secp256k1::new();
        let claimant =
            PrivateKey::new(SecretKey::from_slice(&[0x03; 32]).unwrap(), Network::Bitcoin)
                .public_key(&secp);
        let refund =
            PrivateKey::new(SecretKey::from_slice(&[0x04; 32]).unwrap(), Network::Bitcoin)
                .public_key(&secp);
        (
            BtcHtlc::new(hashlock, claimant, refund, 850_000, Network::Bitcoin).unwrap(),
            preimage,
        )
    }

    fn funding_tx(htlc: &BtcHtlc, sats: u64, height: u64, confirmed: bool) -> MempoolTx {
        MempoolTx {
            txid: "ff".repeat(32),
            status: Some(MempoolTxStatus {
                confirmed,
                block_height: if confirmed { Some(height) } else { None },
                block_hash: Some("bb".repeat(32)),
            }),
            vout: Some(vec![MempoolVout {
                value: sats,
                scriptpubkey: Some(hex::encode(htlc.address.script_pubkey().as_bytes())),
                scriptpubkey_type: Some("v0_p2wsh".into()),
                scriptpubkey_asm: None,
                scriptpubkey_address: Some(htlc.address.to_string()),
            }]),
            vin: None,
        }
    }

    #[test]
    fn find_lock_output_detects_confirmed_funding() {
        let (htlc, _) = test_htlc();
        let txs = vec![funding_tx(&htlc, 150_000, 840_000, true)];
        let want = hex::encode(htlc.address.script_pubkey().as_bytes());
        let lock = find_lock_output(&txs, &want, 100_000, 840_005).unwrap();
        assert_eq!(lock.vout, 0);
        assert_eq!(lock.value_sats, 150_000);
        assert_eq!(lock.confirmations, 6);
    }

    #[test]
    fn find_lock_output_rejects_low_value_and_unconfirmed() {
        let (htlc, _) = test_htlc();
        let want = hex::encode(htlc.address.script_pubkey().as_bytes());
        // Below min_sats.
        let low = vec![funding_tx(&htlc, 50_000, 840_000, true)];
        assert!(find_lock_output(&low, &want, 100_000, 840_005).is_none());
        // Unconfirmed.
        let unconf = vec![funding_tx(&htlc, 150_000, 840_000, false)];
        assert!(find_lock_output(&unconf, &want, 100_000, 840_005).is_none());
        // Different scriptPubKey.
        let mut other = funding_tx(&htlc, 150_000, 840_000, true);
        other.vout.as_mut().unwrap()[0].scriptpubkey = Some("0014aaaa".into());
        assert!(find_lock_output(&[other], &want, 100_000, 840_005).is_none());
    }

    fn spend_tx(lock: &BtcHtlcLock, witness_items: Vec<Vec<u8>>) -> MempoolTx {
        MempoolTx {
            txid: "ee".repeat(32),
            status: Some(MempoolTxStatus {
                confirmed: true,
                block_height: Some(840_001),
                block_hash: None,
            }),
            vout: None,
            vin: Some(vec![MempoolVin {
                txid: Some(lock.txid.clone()),
                vout: Some(lock.vout),
                prevout: None,
                scriptsig_asm: None,
                witness: Some(witness_items.iter().map(hex::encode).collect()),
            }]),
        }
    }

    #[test]
    fn classify_spend_extracts_claim_preimage() {
        use crate::warp::btc_htlc::{spend_htlc_tx, HtlcPath, HtlcUtxo};
        use bitcoin::secp256k1::SecretKey;
        use bitcoin::{Address, OutPoint, PrivateKey, Txid};
        use std::str::FromStr;

        let (htlc, preimage) = test_htlc();
        let lock = BtcHtlcLock {
            txid: "ff".repeat(32),
            vout: 0,
            value_sats: 150_000,
            confirmations: 3,
            block_height: 840_000,
        };
        let claim_key =
            PrivateKey::new(SecretKey::from_slice(&[0x03; 32]).unwrap(), Network::Bitcoin);
        let dest = Address::from_str("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")
            .unwrap()
            .assume_checked();
        let tx = spend_htlc_tx(
            &HtlcUtxo {
                outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), 0),
                value_sats: lock.value_sats,
            },
            &htlc,
            HtlcPath::Claim(preimage),
            &dest,
            &claim_key,
            5,
        )
        .unwrap();
        let items: Vec<Vec<u8>> = tx.input[0].witness.iter().map(|w| w.to_vec()).collect();
        let txs = vec![funding_tx(&htlc, 150_000, 840_000, true), spend_tx(&lock, items)];
        match classify_htlc_spend(&txs, &lock, &htlc) {
            Some(BtcHtlcSpend::Claim { preimage: p, .. }) => assert_eq!(p, preimage),
            other => panic!("expected claim, got {other:?}"),
        }
    }

    #[test]
    fn classify_spend_detects_refund() {
        use crate::warp::btc_htlc::{spend_htlc_tx, HtlcPath, HtlcUtxo};
        use bitcoin::secp256k1::SecretKey;
        use bitcoin::{Address, OutPoint, PrivateKey, Txid};
        use std::str::FromStr;

        let (htlc, _) = test_htlc();
        let lock = BtcHtlcLock {
            txid: "ff".repeat(32),
            vout: 0,
            value_sats: 150_000,
            confirmations: 3,
            block_height: 840_000,
        };
        let refund_key =
            PrivateKey::new(SecretKey::from_slice(&[0x04; 32]).unwrap(), Network::Bitcoin);
        let dest = Address::from_str("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")
            .unwrap()
            .assume_checked();
        let tx = spend_htlc_tx(
            &HtlcUtxo {
                outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), 0),
                value_sats: lock.value_sats,
            },
            &htlc,
            HtlcPath::Refund,
            &dest,
            &refund_key,
            5,
        )
        .unwrap();
        let items: Vec<Vec<u8>> = tx.input[0].witness.iter().map(|w| w.to_vec()).collect();
        let txs = vec![spend_tx(&lock, items)];
        match classify_htlc_spend(&txs, &lock, &htlc) {
            Some(BtcHtlcSpend::Refund { .. }) => {}
            other => panic!("expected refund, got {other:?}"),
        }
    }

    #[test]
    fn classify_spend_ignores_unrelated_txs() {
        let (htlc, _) = test_htlc();
        let lock = BtcHtlcLock {
            txid: "ff".repeat(32),
            vout: 0,
            value_sats: 150_000,
            confirmations: 3,
            block_height: 840_000,
        };
        // A tx spending a different outpoint.
        let spend = MempoolTx {
            txid: "dd".repeat(32),
            status: Some(MempoolTxStatus {
                confirmed: true,
                block_height: Some(840_001),
                block_hash: None,
            }),
            vout: None,
            vin: Some(vec![MempoolVin {
                txid: Some("99".repeat(32)),
                vout: Some(1),
                prevout: None,
                scriptsig_asm: None,
                witness: None,
            }]),
        };
        assert!(classify_htlc_spend(&[spend], &lock, &htlc).is_none());
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
