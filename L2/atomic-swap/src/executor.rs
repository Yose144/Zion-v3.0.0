//! Transaction executor — signs and submits L1 ZION releases from the escrow.
//!
//! Mirrors the `bridge_unlock` logic in `L1/core/src/rpc/methods.rs`:
//! fetches UTXOs for the escrow address, coin-selects, builds a TX,
//! signs with the escrow Ed25519 key, and posts to `/rpc/submit_tx`.

use crate::config::SwapConfig;
use crate::db::SwapDb;
use crate::error::{SwapError, SwapResult};
use crate::types::{SwapPreimage, SwapHash};
use ed25519_dalek::{Signer, SigningKey};
use reqwest::Client;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::time::Duration;
use tracing::{info, warn};

// ─── SwapExecutor ─────────────────────────────────────────────────────────────

pub struct SwapExecutor {
    cfg: Arc<SwapConfig>,
    client: Client,
    /// Cached escrow address (derived from key on startup).
    pub escrow_address: String,
    /// Ed25519 signing key bytes.
    signing_key_bytes: [u8; 32],
}

impl SwapExecutor {
    /// Create executor — reads escrow key from config / env.
    pub fn new(cfg: Arc<SwapConfig>) -> SwapResult<Self> {
        let key_hex = cfg.escrow_key_hex().ok_or_else(|| SwapError::InvalidEscrowKey {
            msg: "ZION_SWAP_ESCROW_KEY not set".into(),
        })?;
        if key_hex.len() != 64 {
            return Err(SwapError::InvalidEscrowKey {
                msg: "Key must be 64 hex chars (32 bytes)".into(),
            });
        }
        let key_bytes: Vec<u8> = hex::decode(&key_hex).map_err(|_| SwapError::InvalidEscrowKey {
            msg: "Key is not valid hex".into(),
        })?;
        let signing_key_bytes: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| SwapError::InvalidEscrowKey {
                msg: "Key must be exactly 32 bytes".into(),
            })?;

        let signing_key = SigningKey::from_bytes(&signing_key_bytes);
        let pk = signing_key.verifying_key();
        let escrow_address = zion1_address_from_pk(pk.as_bytes());

        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .expect("Failed to build HTTP client");

        Ok(Self {
            cfg,
            client,
            escrow_address,
            signing_key_bytes,
        })
    }

    // ── Claim (S-03) ──────────────────────────────────────────────────────

    /// Release ZION to the claimer after verifying the preimage.
    pub async fn execute_claim(
        &self,
        db: &SwapDb,
        hash_hex: &str,
        preimage_hex: &str,
        recipient: &str,
    ) -> SwapResult<()> {
        // 1. Fetch HTLC record
        let rec = db
            .get_htlc(hash_hex)?
            .ok_or_else(|| SwapError::HtlcNotFound {
                hash_hex: hash_hex.to_string(),
            })?;

        // 2. Guard: already settled?
        if rec.is_terminal() {
            return Err(SwapError::AlreadySettled {
                hash_hex: hash_hex.to_string(),
                state: rec.state.to_string(),
            });
        }

        // 3. Guard: timelock expired?
        if rec.is_expired() {
            return Err(SwapError::TimelockExpired {
                hash_hex: hash_hex.to_string(),
            });
        }

        // 4. Verify preimage
        let preimage_bytes = hex::decode(preimage_hex)?;
        let preimage_arr: [u8; 32] = preimage_bytes.try_into().map_err(|_| {
            SwapError::Internal("Preimage must be 32 bytes".into())
        })?;
        let preimage = SwapPreimage(preimage_arr);
        let computed_hash = preimage.hash();
        let expected_hash = SwapHash::from_hex(hash_hex).ok_or_else(|| {
            SwapError::Internal("Invalid hash_hex".into())
        })?;
        if computed_hash != expected_hash {
            return Err(SwapError::PreimageMismatch);
        }

        // 5. Release ZION
        let release_fee = self.cfg.swap.release_fee_atomic;
        let amount = rec.amount_atomic.saturating_sub(release_fee);
        let tx_id = self
            .submit_release(amount, recipient, Some(hash_hex))
            .await?;

        // 6. Persist
        db.mark_claimed(hash_hex, &tx_id, recipient, preimage_hex)?;
        info!(
            "✅ CLAIM settled hash={hash_hex} → recipient={recipient} tx={tx_id}"
        );
        Ok(())
    }

    // ── Refund (S-04) ─────────────────────────────────────────────────────

    /// Refund ZION to the original locker after timelock expiry.
    pub async fn execute_refund(&self, db: &SwapDb, hash_hex: &str) -> SwapResult<()> {
        let rec = db
            .get_htlc(hash_hex)?
            .ok_or_else(|| SwapError::HtlcNotFound {
                hash_hex: hash_hex.to_string(),
            })?;

        if rec.is_terminal() {
            return Err(SwapError::AlreadySettled {
                hash_hex: hash_hex.to_string(),
                state: rec.state.to_string(),
            });
        }

        if !rec.is_expired() {
            return Err(SwapError::TimelockActive {
                hash_hex: hash_hex.to_string(),
                expires_at: rec.expires_at,
            });
        }

        let release_fee = self.cfg.swap.release_fee_atomic;
        let amount = rec.amount_atomic.saturating_sub(release_fee);
        let tx_id = self
            .submit_release(amount, &rec.locker_address, Some(hash_hex))
            .await?;

        db.mark_refunded(hash_hex, &tx_id)?;
        info!(
            "↩️  REFUND settled hash={hash_hex} → locker={} tx={tx_id}",
            rec.locker_address
        );
        Ok(())
    }

    // ── L1 TX builder + submitter ─────────────────────────────────────────

    async fn submit_release(
        &self,
        amount: u64,
        recipient: &str,
        memo_hash: Option<&str>,
    ) -> SwapResult<String> {
        let signing_key = SigningKey::from_bytes(&self.signing_key_bytes);
        let pk = signing_key.verifying_key();
        let pk_hex = hex::encode(pk.as_bytes());

        // ── Fetch UTXOs for escrow ────────────────────────────────────────
        let utxos = self.fetch_utxos(&self.escrow_address).await?;

        let fee: u64 = 1_000;
        let needed = amount.saturating_add(fee);

        let mut sorted = utxos;
        sorted.sort_by(|a, b| {
            b["amount"]
                .as_u64()
                .unwrap_or(0)
                .cmp(&a["amount"].as_u64().unwrap_or(0))
        });

        let mut selected: Vec<serde_json::Value> = Vec::new();
        let mut total_in: u64 = 0;
        for utxo in sorted {
            total_in += utxo["amount"].as_u64().unwrap_or(0);
            selected.push(utxo);
            if total_in >= needed {
                break;
            }
        }

        if total_in < needed {
            return Err(SwapError::InsufficientBalance {
                have: total_in,
                need: needed,
            });
        }

        let change = total_in - amount - fee;

        // ── Build TX JSON ─────────────────────────────────────────────────
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let inputs: Vec<serde_json::Value> = selected
            .iter()
            .map(|utxo| {
                let key = utxo["key"].as_str().unwrap_or("");
                let parts: Vec<&str> = key.rsplitn(2, ':').collect();
                let (output_index, prev_tx_hash) = if parts.len() == 2 {
                    (
                        parts[0].parse::<u32>().unwrap_or(0),
                        parts[1].to_string(),
                    )
                } else {
                    (0u32, key.to_string())
                };
                serde_json::json!({
                    "prev_tx_hash": prev_tx_hash,
                    "output_index": output_index,
                    "signature": "",
                    "public_key": pk_hex,
                })
            })
            .collect();

        let memo_str = memo_hash.map(|h| format!("SWAP:RELEASE:{h}"));
        let mut outputs = vec![serde_json::json!({
            "amount": amount,
            "address": recipient,
            "memo": memo_str,
        })];
        if change > 0 {
            outputs.push(serde_json::json!({
                "amount": change,
                "address": self.escrow_address,
                "memo": null,
            }));
        }

        // ── Compute TX hash ────────────────────────────────────────────────
        // Mirror L1 calculate_hash: version(LE4) + inputs(pk_hex) + outputs(amount LE8, addr, memo) + fee LE8 + timestamp LE8
        let tx_hash_hex = compute_tx_hash(1u32, &inputs, &outputs, fee, ts);

        // ── Sign each input ────────────────────────────────────────────────
        let msg_bytes = hex::decode(&tx_hash_hex)
            .map_err(|_| SwapError::Internal("TX hash decode failed".into()))?;
        let signed_inputs: Vec<serde_json::Value> = inputs
            .into_iter()
            .map(|mut inp| {
                let sig = signing_key.sign(&msg_bytes);
                inp["signature"] = serde_json::Value::String(hex::encode(sig.to_bytes()));
                inp
            })
            .collect();

        let tx_json = serde_json::json!({
            "id": tx_hash_hex,
            "version": 1,
            "inputs": signed_inputs,
            "outputs": outputs,
            "fee": fee,
            "timestamp": ts,
        });

        // ── Submit to L1 mempool ───────────────────────────────────────────
        let url = format!("{}/rpc/submit_tx", self.cfg.l1.rpc_url);
        let mut req = self.client.post(&url).json(&tx_json);
        if let Some(tok) = self.cfg.rpc_token() {
            req = req.bearer_auth(tok);
        }
        let resp: serde_json::Value = req.send().await?.json().await?;
        if resp["status"].as_str() != Some("ok") {
            warn!("L1 submit_tx response: {resp}");
            return Err(SwapError::L1Rpc(format!(
                "submit_tx rejected: {}",
                resp["message"].as_str().unwrap_or("unknown")
            )));
        }
        Ok(tx_hash_hex)
    }

    // ── UTXO fetch ────────────────────────────────────────────────────────

    async fn fetch_utxos(&self, address: &str) -> SwapResult<Vec<serde_json::Value>> {
        let url = format!("{}/api/address/{address}/utxos", self.cfg.l1.rpc_url);
        let mut req = self.client.get(&url);
        if let Some(tok) = self.cfg.rpc_token() {
            req = req.bearer_auth(tok);
        }
        let resp: serde_json::Value = req.send().await?.json().await?;
        if resp["status"].as_str() != Some("ok") {
            return Err(SwapError::L1Rpc("Failed to fetch UTXOs".into()));
        }
        let utxos = resp["utxos"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        Ok(utxos)
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Compute L1 TX hash (mirrors Transaction::calculate_hash in L1/core/src/tx/mod.rs).
fn compute_tx_hash(
    version: u32,
    inputs: &[serde_json::Value],
    outputs: &[serde_json::Value],
    fee: u64,
    timestamp: u64,
) -> String {
    let mut data: Vec<u8> = Vec::new();
    data.extend_from_slice(&version.to_le_bytes());
    for inp in inputs {
        if let Some(prev) = inp["prev_tx_hash"].as_str() {
            data.extend_from_slice(prev.as_bytes());
        }
        if let Some(idx) = inp["output_index"].as_u64() {
            data.extend_from_slice(&(idx as u32).to_le_bytes());
        }
        if let Some(pk) = inp["public_key"].as_str() {
            data.extend_from_slice(pk.as_bytes());
        }
    }
    for out in outputs {
        if let Some(amt) = out["amount"].as_u64() {
            data.extend_from_slice(&amt.to_le_bytes());
        }
        if let Some(addr) = out["address"].as_str() {
            data.extend_from_slice(addr.as_bytes());
        }
        if let Some(memo) = out["memo"].as_str() {
            data.extend_from_slice(memo.as_bytes());
        }
    }
    data.extend_from_slice(&fee.to_le_bytes());
    data.extend_from_slice(&timestamp.to_le_bytes());
    // L1 uses blake3 (crate alias `hash::blake`).  We use SHA-256 here as a
    // safe fallback for the off-chain daemon — the real hash must match the
    // node.  TODO: replace with blake3 crate when Cargo workspace allows it.
    let hash = Sha256::digest(&data);
    hex::encode(hash)
}

/// Derive zion1 address from 32-byte Ed25519 public key  (double-SHA256 → 20B → hex).
fn zion1_address_from_pk(pk_bytes: &[u8]) -> String {
    let h1 = Sha256::digest(pk_bytes);
    let h2 = Sha256::digest(&h1);
    format!("zion1{}", hex::encode(&h2[..20]))
}
