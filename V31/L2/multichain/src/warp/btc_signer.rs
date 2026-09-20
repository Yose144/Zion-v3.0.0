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
use crate::warp::error::{WarpError, WarpResult};

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
pub(crate) struct MempoolUtxo {
    pub(crate) txid: String,
    pub(crate) vout: u32,
    pub(crate) value: u64,
    pub(crate) status: Option<UtxoStatus>,
}

#[derive(Deserialize, Clone)]
pub(crate) struct UtxoStatus {
    pub(crate) confirmed: bool,
}

impl MempoolUtxo {
    pub(crate) fn is_confirmed(&self) -> bool {
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
#[derive(Clone)]
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
        let network = parse_network(&network_str)?;
        Self::from_wif(&wif, network)
    }

    /// Create from WIF string + network.
    pub fn from_wif(wif: &str, network: Network) -> WarpResult<Self> {
        let secp = Secp256k1::new();
        let private_key = PrivateKey::from_wif(wif).map_err(|e| WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: format!("WIF parse error: {}", e),
        })?;
        // Reject mainnet/test-family WIF mismatches so a testnet key can never
        // sign mainnet spends (or vice versa). Testnet WIFs are valid for
        // Testnet, Signet and Regtest.
        let wif_is_mainnet = private_key.network == Network::Bitcoin;
        let target_is_mainnet = network == Network::Bitcoin;
        if wif_is_mainnet != target_is_mainnet {
            return Err(WarpError::AdapterError {
                chain: "bitcoin".into(),
                reason: format!(
                    "WIF network mismatch: key is {}, configured network is {network}",
                    private_key.network
                ),
            });
        }
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

    /// The relay wallet's `bitcoin::PublicKey` (compressed).
    pub fn public_key_btc(&self) -> &PublicKey {
        &self.public_key
    }

    /// Raw compressed pubkey bytes.
    pub fn public_key_bytes(&self) -> Vec<u8> {
        self.public_key.to_bytes()
    }

    /// Access the private key (crate-internal; used by HTLC spend paths).
    pub(crate) fn private_key_inner(&self) -> &PrivateKey {
        &self.private_key
    }

    /// The configured Bitcoin network.
    pub fn network(&self) -> Network {
        self.network
    }

    /// Fetch confirmed UTXOs for the relay wallet, select enough to cover
    /// amount + fee, build+sign the transaction, and broadcast it.
    /// Returns the txid on success.
    pub async fn send_btc(
        &self,
        client: &reqwest::Client,
        api_urls: &[String],
        recipient: &str,
        amount_sats: u64,
    ) -> WarpResult<String> {
        let feerate = std::env::var("WARP_BTC_FEERATE")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(5);

        // 1. Fetch + filter confirmed UTXOs
        let utxos = fetch_utxos(client, api_urls, &self.address.to_string()).await?;
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

        let txid = broadcast_tx(client, api_urls, &raw_hex).await?;

        info!("[WARP][bitcoin] TX broadcast OK: {}", txid);
        Ok(txid)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn parse_network(s: &str) -> WarpResult<Network> {
    match s.trim().to_ascii_lowercase().as_str() {
        "mainnet" | "bitcoin" => Ok(Network::Bitcoin),
        "testnet" => Ok(Network::Testnet),
        "signet" => Ok(Network::Signet),
        "regtest" => Ok(Network::Regtest),
        other => Err(WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: format!("invalid BITCOIN_NETWORK '{other}'"),
        }),
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

/// GET `path` against each endpoint in `api_urls` until one returns a
/// successful body. `bitcoind+rpc://` entries are translated to JSON-RPC;
/// plain `http(s)://` entries behave as esplora (failover preserved).
/// Retained for callers that want first-success failover; `fetch_utxos` uses
/// its own data-aware loop instead.
#[allow(dead_code)]
pub(crate) async fn get_text_failover(
    client: &reqwest::Client,
    api_urls: &[String],
    path: &str,
) -> WarpResult<String> {
    let mut last_err = WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: "no bitcoin API endpoints configured".into(),
    };
    for (idx, base) in api_urls.iter().enumerate() {
        match crate::warp::bitcoind_rpc::backend_get(client, base, path).await {
            Ok(text) => return Ok(text),
            Err(e) => {
                last_err = WarpError::AdapterError {
                    chain: "bitcoin".into(),
                    reason: format!("bitcoin backend #{} request {path} failed: {e}", idx + 1),
                };
            }
        }
    }
    Err(last_err)
}

/// Fetch relay UTXOs with data-aware failover: a valid-but-empty response is
/// remembered but does not stop the loop — a reset/pruned watch wallet can
/// otherwise hide funded UTXOs that another backend still sees. The first
/// endpoint returning a non-empty set wins; empty-only responses yield
/// `Ok(vec![])`; if no endpoint produced a valid body, the last redacted
/// error is returned.
pub(crate) async fn fetch_utxos(
    client: &reqwest::Client,
    api_urls: &[String],
    address: &str,
) -> WarpResult<Vec<MempoolUtxo>> {
    let path = format!("/address/{address}/utxo");
    let mut saw_empty = false;
    let mut last_err = WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: "no bitcoin API endpoints configured".into(),
    };
    for (idx, base) in api_urls.iter().enumerate() {
        match crate::warp::bitcoind_rpc::backend_get(client, base, &path).await {
            Ok(text) => match serde_json::from_str::<Vec<MempoolUtxo>>(&text) {
                Ok(utxos) if !utxos.is_empty() => return Ok(utxos),
                Ok(_) => saw_empty = true,
                Err(e) => {
                    last_err = WarpError::AdapterError {
                        chain: "bitcoin".into(),
                        reason: format!(
                            "bitcoin backend #{} response decode failed: {e}",
                            idx + 1
                        ),
                    };
                }
            },
            Err(e) => {
                last_err = WarpError::AdapterError {
                    chain: "bitcoin".into(),
                    reason: format!("bitcoin backend #{} request {path} failed: {e}", idx + 1),
                };
            }
        }
    }
    if saw_empty {
        Ok(vec![])
    } else {
        Err(last_err)
    }
}

/// Greedy UTXO selection: sort largest-first, select until amount + estimated fee is covered.
pub(crate) fn select_utxos(
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

/// Broadcast a raw tx via each endpoint in `api_urls` until one accepts it.
/// `bitcoind+rpc://` entries go through `sendrawtransaction`; submitting to
/// multiple backends is harmless — the txid is identical.
pub(crate) async fn broadcast_tx(
    client: &reqwest::Client,
    api_urls: &[String],
    raw_hex: &str,
) -> WarpResult<String> {
    let mut last_err = WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: "no bitcoin API endpoints configured".into(),
    };
    for (idx, base) in api_urls.iter().enumerate() {
        match crate::warp::bitcoind_rpc::backend_post_tx(client, base, raw_hex).await {
            Ok(txid) => return Ok(txid),
            Err(e) => {
                last_err = WarpError::AdapterError {
                    chain: "bitcoin".into(),
                    reason: format!("bitcoin backend #{} broadcast failed: {e}", idx + 1),
                };
            }
        }
    }
    Err(last_err)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_network_mainnet() {
        assert_eq!(parse_network("mainnet").unwrap(), Network::Bitcoin);
        assert_eq!(parse_network("bitcoin").unwrap(), Network::Bitcoin);
    }

    #[test]
    fn test_parse_network_testnet() {
        assert_eq!(parse_network("testnet").unwrap(), Network::Testnet);
        assert_eq!(parse_network("signet").unwrap(), Network::Signet);
        assert_eq!(parse_network("regtest").unwrap(), Network::Regtest);
    }

    #[test]
    fn test_parse_network_rejects_invalid() {
        assert!(parse_network("unknown").is_err());
        assert!(parse_network("").is_err());
        assert!(parse_network("testnet3").is_err());
    }

    #[test]
    fn test_from_wif_rejects_mainnet_key_on_testnet() {
        // Known mainnet WIF test vector must not be usable on test-family nets.
        let wif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn";
        assert!(BtcSigner::from_wif(wif, Network::Testnet).is_err());
        assert!(BtcSigner::from_wif(wif, Network::Signet).is_err());
        assert!(BtcSigner::from_wif(wif, Network::Bitcoin).is_ok());
    }

    #[test]
    fn test_from_wif_testnet_key_accepted_on_test_family() {
        let sk = bitcoin::secp256k1::SecretKey::from_slice(&[0x03u8; 32]).unwrap();
        let wif = PrivateKey::new(sk, Network::Testnet).to_wif();
        assert!(BtcSigner::from_wif(&wif, Network::Testnet).is_ok());
        assert!(BtcSigner::from_wif(&wif, Network::Signet).is_ok());
        assert!(BtcSigner::from_wif(&wif, Network::Regtest).is_ok());
        assert!(BtcSigner::from_wif(&wif, Network::Bitcoin).is_err());
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

    async fn mock_json_server(body: &'static str) -> String {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut sock, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 4096];
                    let _ = sock.read(&mut buf).await;
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = sock.write_all(resp.as_bytes()).await;
                });
            }
        });
        format!("http://127.0.0.1:{port}")
    }

    #[tokio::test]
    async fn fetch_utxos_falls_through_empty_backend() {
        let empty = mock_json_server("[]").await;
        let populated = mock_json_server(
            "[{\"txid\":\"bbcc\",\"vout\":0,\"value\":50000,\"status\":{\"confirmed\":true}}]",
        )
        .await;
        let client = reqwest::Client::new();
        let urls = vec![empty, populated];
        let utxos = fetch_utxos(&client, &urls, "tb1qtestrelay")
            .await
            .expect("fall through to populated endpoint");
        assert_eq!(utxos.len(), 1);
        assert_eq!(utxos[0].txid, "bbcc");
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
