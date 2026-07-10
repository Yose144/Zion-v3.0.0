/// Bitcoin P2WPKH Transaction Signing
///
/// Signs and broadcasts raw Bitcoin transactions for the WARP relay wallet.
/// No external bitcoind required — uses mempool.space REST API for UTXOs + broadcast.
///
/// Signing flow:
///   1. Load WIF private key from env → derive compressed public key + P2WPKH address
///   2. Fetch confirmed UTXOs for relay address via GET /address/{addr}/utxo
///   3. Greedy UTXO selection (largest-first) to cover amount + estimated fee
///   4. Build transaction: n P2WPKH inputs → 1 recipient output + 1 change output
///   5. BIP143 sighash per input (segwit v0)
///   6. ECDSA sign with secp256k1 private key
///   7. Broadcast via POST /tx
///
/// Environment Variables:
///   WARP_BTC_RELAY_KEY   — WIF-encoded secp256k1 private key (required for live minting)
///   WARP_BTC_FEERATE     — sat/vbyte (default: 5)
///   BITCOIN_NETWORK      — "mainnet" | "testnet" | "signet" (default: "mainnet")
use crate::error::{WarpError, WarpResult};

use bitcoin::secp256k1::{Message, Secp256k1};
use bitcoin::{
    absolute::LockTime,
    consensus::encode::serialize,
    sighash::{EcdsaSighashType, SighashCache},
    transaction::Version,
    Address, Amount, Network, OutPoint, PrivateKey, PublicKey, ScriptBuf, Sequence, Transaction,
    TxIn, TxOut, Txid, Witness,
};
use serde::Deserialize;
use std::str::FromStr;
use tracing::{debug, info};

// ─────────────────────────────────────────────────────────────────────────────
// mempool.space UTXO types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize, Clone)]
struct MempoolUtxo {
    txid: String,
    vout: u32,
    value: u64,
    status: Option<UtxoStatus>,
}

#[derive(Deserialize, Clone)]
struct UtxoStatus {
    confirmed: bool,
}

impl MempoolUtxo {
    fn is_confirmed(&self) -> bool {
        self.status.as_ref().map(|s| s.confirmed).unwrap_or(false)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee estimation
// ─────────────────────────────────────────────────────────────────────────────

/// Estimate virtual size (vbytes) for a P2WPKH-only transaction.
///
/// Formula (BIP141):
///   base_size = 10 (version+locktime+counts) + 41*n_in + 31*n_out
///   witness_size = (1 + 1 + 73 + 1 + 33) * n_in  ≈ 109 bytes per input
///   vbytes = base_size + ceil(witness_size / 4)
fn estimate_vbytes(n_in: usize, n_out: usize) -> u64 {
    let base = 10u64 + 41 * n_in as u64 + 31 * n_out as u64;
    let witness = 109u64 * n_in as u64; // flags(2) + items(1+73+1+33) per input
    base + witness.div_ceil(4)
}

// ─────────────────────────────────────────────────────────────────────────────
// BtcSigner
// ─────────────────────────────────────────────────────────────────────────────

/// Holds the relay wallet's private key + derived address.
pub struct BtcSigner {
    private_key: PrivateKey,
    public_key: PublicKey,
    address: Address,
    network: Network,
}

impl BtcSigner {
    /// Load from `WARP_BTC_RELAY_KEY` env var (WIF format).
    pub fn from_env() -> WarpResult<Self> {
        let wif = std::env::var("WARP_BTC_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: "WARP_BTC_RELAY_KEY env var not set".into(),
        })?;
        let network_str = std::env::var("BITCOIN_NETWORK").unwrap_or_else(|_| "mainnet".into());
        let network = parse_network(&network_str);
        Self::from_wif(&wif, network)
    }

    /// Create from WIF string + network.
    pub fn from_wif(wif: &str, network: Network) -> WarpResult<Self> {
        let secp = Secp256k1::new();
        let private_key = PrivateKey::from_wif(wif).map_err(|e| WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: format!("WIF parse error: {}", e),
        })?;
        let public_key = private_key.public_key(&secp);
        let address = p2wpkh_address(&public_key, network)?;
        Ok(Self {
            private_key,
            public_key,
            address,
            network,
        })
    }

    /// The relay wallet's P2WPKH address (used for UTXO lookup).
    pub fn address(&self) -> &Address {
        &self.address
    }

    /// Fetch confirmed UTXOs for the relay wallet, select enough to cover
    /// amount + fee, build+sign the transaction, and broadcast it.
    /// Returns the txid on success.
    pub async fn send_btc(
        &self,
        client: &reqwest::Client,
        api_url: &str,
        recipient: &str,
        amount_sats: u64,
    ) -> WarpResult<String> {
        let feerate = std::env::var("WARP_BTC_FEERATE")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(5);

        // 1. Fetch + filter confirmed UTXOs
        let utxos = fetch_utxos(client, api_url, &self.address.to_string()).await?;
        let confirmed: Vec<MempoolUtxo> = utxos.into_iter().filter(|u| u.is_confirmed()).collect();

        if confirmed.is_empty() {
            return Err(WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: format!("No confirmed UTXOs for relay address {}", self.address),
            });
        }

        // 2. Select UTXOs (largest first)
        let (selected, fee) = select_utxos(&confirmed, amount_sats, feerate)?;
        let total_in: u64 = selected.iter().map(|u| u.value).sum();
        let change = total_in - amount_sats - fee;

        debug!(
            "[WARP][bitcoin] {} UTXOs selected, total={} sats, amount={}, fee={}, change={}",
            selected.len(),
            total_in,
            amount_sats,
            fee,
            change
        );

        // 3. Parse recipient address
        let recipient_addr = Address::from_str(recipient)
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: format!("Invalid recipient address '{}': {}", recipient, e),
            })?
            .require_network(self.network)
            .map_err(|e| WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: format!("Recipient network mismatch: {}", e),
            })?;

        // 4. Build unsigned transaction
        let mut tx = build_unsigned_tx(
            &selected,
            &recipient_addr,
            amount_sats,
            change,
            &self.address,
        )?;

        // 5. Sign each input
        let secp = Secp256k1::new();
        let relay_spk = self.address.script_pubkey();

        for (i, utxo) in selected.iter().enumerate() {
            let sighash = {
                let mut cache = SighashCache::new(&tx);
                cache
                    .p2wpkh_signature_hash(
                        i,
                        &relay_spk,
                        Amount::from_sat(utxo.value),
                        EcdsaSighashType::All,
                    )
                    .map_err(|e| WarpError::AdapterError {
                        chain: "bitcoin".into(),
                        reason: format!("Sighash error at input {}: {}", i, e),
                    })?
            };

            let msg = Message::from_digest_slice(sighash.as_ref()).map_err(|e| {
                WarpError::AdapterError {
                    chain: "bitcoin".into(),
                    reason: format!("Message digest error at input {}: {}", i, e),
                }
            })?;
            let sig = secp.sign_ecdsa(&msg, &self.private_key.inner);

            let mut sig_bytes = sig.serialize_der().to_vec();
            sig_bytes.push(EcdsaSighashType::All.to_u32() as u8);

            let pubkey_bytes = self.public_key.to_bytes();
            tx.input[i].witness =
                Witness::from_slice(&[sig_bytes.as_slice(), pubkey_bytes.as_slice()]);
        }

        // 6. Serialize and broadcast
        let raw = serialize(&tx);
        let raw_hex = hex::encode(&raw);

        info!(
            "[WARP][bitcoin] Broadcasting TX {} bytes, {} inputs, {} + {} sats",
            raw.len(),
            selected.len(),
            amount_sats,
            fee
        );

        let txid = broadcast_tx(client, api_url, &raw_hex).await?;

        info!("[WARP][bitcoin] TX broadcast OK: {}", txid);
        Ok(txid)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn parse_network(s: &str) -> Network {
    match s {
        "testnet" => Network::Testnet,
        "signet" => Network::Signet,
        "regtest" => Network::Regtest,
        _ => Network::Bitcoin,
    }
}

fn p2wpkh_address(pubkey: &PublicKey, network: Network) -> WarpResult<Address> {
    if !pubkey.compressed {
        return Err(WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: "BTC relay key must be compressed (WIF with 'c' prefix or length=52)".into(),
        });
    }
    let wpkh = pubkey
        .wpubkey_hash()
        .ok_or_else(|| WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: "Failed to derive P2WPKH hash from public key".into(),
        })?;
    let spk = ScriptBuf::new_p2wpkh(&wpkh);
    Address::from_script(&spk, network).map_err(|e| WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: format!("Address derivation error: {}", e),
    })
}

async fn fetch_utxos(
    client: &reqwest::Client,
    api_url: &str,
    address: &str,
) -> WarpResult<Vec<MempoolUtxo>> {
    let url = format!("{}/address/{}/utxo", api_url, address);
    let utxos: Vec<MempoolUtxo> = client
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
    Ok(utxos)
}

/// Greedy UTXO selection: sort largest-first, select until amount + estimated fee is covered.
fn select_utxos(
    utxos: &[MempoolUtxo],
    amount: u64,
    feerate: u64,
) -> WarpResult<(Vec<MempoolUtxo>, u64)> {
    let mut sorted = utxos.to_vec();
    sorted.sort_by_key(|b| std::cmp::Reverse(b.value));

    let mut selected: Vec<MempoolUtxo> = Vec::new();
    let mut total: u64 = 0;

    for utxo in sorted {
        selected.push(utxo.clone());
        total += utxo.value;
        // Estimate fee: n inputs, 2 outputs (recipient + change); or 1 if change < dust
        let n_out = if total > amount + feerate * estimate_vbytes(selected.len(), 1) + 546 {
            2
        } else {
            1
        };
        let fee = feerate * estimate_vbytes(selected.len(), n_out);
        if total >= amount + fee {
            return Ok((selected, fee));
        }
    }

    Err(WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: format!(
            "Insufficient funds: have {} sats, need {} + fee",
            total, amount
        ),
    })
}

fn build_unsigned_tx(
    selected: &[MempoolUtxo],
    recipient: &Address,
    amount: u64,
    change: u64,
    change_addr: &Address,
) -> WarpResult<Transaction> {
    const DUST: u64 = 546; // P2WPKH dust threshold

    let inputs: Vec<TxIn> = selected
        .iter()
        .map(|u| {
            let txid = Txid::from_str(&u.txid).expect("valid txid");
            TxIn {
                previous_output: OutPoint::new(txid, u.vout),
                script_sig: ScriptBuf::default(),
                sequence: Sequence::MAX,
                witness: Witness::default(),
            }
        })
        .collect();

    let mut outputs = vec![TxOut {
        value: Amount::from_sat(amount),
        script_pubkey: recipient.script_pubkey(),
    }];

    // Add change output only if above dust limit
    if change >= DUST {
        outputs.push(TxOut {
            value: Amount::from_sat(change),
            script_pubkey: change_addr.script_pubkey(),
        });
    }

    Ok(Transaction {
        version: Version::TWO,
        lock_time: LockTime::ZERO,
        input: inputs,
        output: outputs,
    })
}

async fn broadcast_tx(
    client: &reqwest::Client,
    api_url: &str,
    raw_hex: &str,
) -> WarpResult<String> {
    let url = format!("{}/tx", api_url);
    let resp = client
        .post(&url)
        .header("Content-Type", "text/plain")
        .body(raw_hex.to_string())
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: e.to_string(),
        })?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: format!("Broadcast failed HTTP {}: {}", status, body.trim()),
        });
    }

    // mempool.space returns the txid as plain text on success
    Ok(body.trim().to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_network_mainnet() {
        assert_eq!(parse_network("mainnet"), Network::Bitcoin);
    }

    #[test]
    fn test_parse_network_testnet() {
        assert_eq!(parse_network("testnet"), Network::Testnet);
    }

    #[test]
    fn test_parse_network_default() {
        assert_eq!(parse_network("unknown"), Network::Bitcoin);
    }

    #[test]
    fn test_estimate_vbytes_1in_2out() {
        // 1 P2WPKH input, 2 outputs: ~189 vbytes
        let v = estimate_vbytes(1, 2);
        assert!(
            (140..=200).contains(&v),
            "vbytes={} out of expected range 140-200",
            v
        );
    }

    #[test]
    fn test_estimate_vbytes_2in_2out() {
        let v1 = estimate_vbytes(1, 2);
        let v2 = estimate_vbytes(2, 2);
        assert!(v2 > v1, "2 inputs should be larger than 1 input");
    }

    #[test]
    fn test_btc_signer_from_wif_mainnet() {
        // Known WIF test vector — mainnet compressed
        let wif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn";
        let signer = BtcSigner::from_wif(wif, Network::Bitcoin).unwrap();
        let addr = signer.address().to_string();
        // Compressed WIF → should produce a valid bech32 P2WPKH address
        assert!(
            addr.starts_with("bc1q"),
            "Expected bech32 addr, got: {}",
            addr
        );
    }

    #[test]
    fn test_btc_signer_from_wif_invalid() {
        assert!(BtcSigner::from_wif("notawif", Network::Bitcoin).is_err());
    }

    #[test]
    fn test_select_utxos_sufficient() {
        let utxos = vec![
            MempoolUtxo {
                txid: "aaaa".into(),
                vout: 0,
                value: 500_000,
                status: Some(UtxoStatus { confirmed: true }),
            },
            MempoolUtxo {
                txid: "bbbb".into(),
                vout: 0,
                value: 200_000,
                status: Some(UtxoStatus { confirmed: true }),
            },
        ];
        let (selected, fee) = select_utxos(&utxos, 100_000, 5).unwrap();
        assert_eq!(selected.len(), 1); // 500k is enough
        assert!(fee > 0 && fee < 10_000);
    }

    #[test]
    fn test_select_utxos_insufficient() {
        let utxos = vec![MempoolUtxo {
            txid: "aaaa".into(),
            vout: 0,
            value: 100,
            status: Some(UtxoStatus { confirmed: true }),
        }];
        assert!(select_utxos(&utxos, 100_000, 5).is_err());
    }

    #[test]
    fn test_select_utxos_multi_input() {
        let utxos = vec![
            MempoolUtxo {
                txid: "a".into(),
                vout: 0,
                value: 50_000,
                status: Some(UtxoStatus { confirmed: true }),
            },
            MempoolUtxo {
                txid: "b".into(),
                vout: 0,
                value: 50_000,
                status: Some(UtxoStatus { confirmed: true }),
            },
            MempoolUtxo {
                txid: "c".into(),
                vout: 0,
                value: 50_000,
                status: Some(UtxoStatus { confirmed: true }),
            },
        ];
        let (selected, fee) = select_utxos(&utxos, 90_000, 5).unwrap();
        assert!(selected.len() <= 3);
        let total_in: u64 = selected.iter().map(|u| u.value).sum();
        assert!(total_in >= 90_000 + fee);
    }

    #[test]
    fn test_build_unsigned_tx_structure() {
        let wif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn";
        let signer = BtcSigner::from_wif(wif, Network::Bitcoin).unwrap();

        let utxo = MempoolUtxo {
            txid: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2".into(),
            vout: 0,
            value: 200_000,
            status: Some(UtxoStatus { confirmed: true }),
        };
        let recipient_str = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
        let recipient = Address::from_str(recipient_str).unwrap().assume_checked();

        let tx = build_unsigned_tx(&[utxo], &recipient, 100_000, 99_000, signer.address()).unwrap();
        assert_eq!(tx.input.len(), 1);
        assert_eq!(tx.output.len(), 2); // recipient + change (99k > 546 dust)
        assert_eq!(tx.output[0].value, Amount::from_sat(100_000));
        assert_eq!(tx.output[1].value, Amount::from_sat(99_000));
    }

    #[test]
    fn test_build_unsigned_tx_dust_change_dropped() {
        let wif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn";
        let signer = BtcSigner::from_wif(wif, Network::Bitcoin).unwrap();

        let utxo = MempoolUtxo {
            txid: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2".into(),
            vout: 0,
            value: 100_200,
            status: Some(UtxoStatus { confirmed: true }),
        };
        let recipient_str = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
        let recipient = Address::from_str(recipient_str).unwrap().assume_checked();

        // change = 100, below dust threshold 546
        let tx = build_unsigned_tx(&[utxo], &recipient, 100_100, 100, signer.address()).unwrap();
        assert_eq!(tx.output.len(), 1); // no change output (dust)
    }
}
