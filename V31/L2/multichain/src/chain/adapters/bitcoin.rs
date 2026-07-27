//! Bitcoin adapter — mempool.space REST API.
//!
//! Current scope (Mainnet Alpha scaffold):
//! - read chain height,
//! - read confirmed + unconfirmed UTXO balance,
//! - tx confirmations.
//!
//! Sending (P2WPKH build + sign) and deposit watching are deferred to the next
//! iteration, where the adapter will receive a `BitcoinSigner` from the keyring.

use async_trait::async_trait;
use bitcoin::hashes::Hash as _;
use serde::Deserialize;
use std::str::FromStr;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};
use crate::wallet::Keyring;

const MAINNET_API: &str = "https://mempool.space/api";
const TESTNET_API: &str = "https://mempool.space/testnet/api";
const SIGNET_API: &str = "https://mempool.space/signet/api";

/// Network name as accepted by `bitcoin::Network::from_core_arg`.
#[derive(Clone, Debug)]
pub struct BitcoinAdapter {
    network: bitcoin::Network,
    api_url: String,
    client: reqwest::Client,
    keyring: Keyring,
    deposit_address: Address,
    deposit_address_str: String,
}

impl BitcoinAdapter {
    pub fn new(
        network_str: &str,
        rpc_url: Option<&str>,
        keyring: &Keyring,
    ) -> MultichainResult<Self> {
        let network = bitcoin::Network::from_core_arg(network_str).map_err(|_| {
            MultichainError::Config(format!("unknown bitcoin network: {network_str}"))
        })?;

        let api_url = if let Some(url) = rpc_url.filter(|u| !u.is_empty()) {
            url.to_string()
        } else {
            match network {
                bitcoin::Network::Bitcoin => MAINNET_API,
                bitcoin::Network::Testnet => TESTNET_API,
                bitcoin::Network::Signet => SIGNET_API,
                _ => MAINNET_API,
            }
            .to_string()
        };

        let deposit_address = keyring.bitcoin_address_for_network(network, 0, 0)?;
        let deposit_address_str = deposit_address.encoded.clone();

        Ok(Self {
            network,
            api_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .map_err(|e| MultichainError::Internal(e.to_string()))?,
            keyring: keyring.clone(),
            deposit_address,
            deposit_address_str,
        })
    }

    fn validate_address(
        &self,
        addr: &Address,
    ) -> MultichainResult<bitcoin::Address<bitcoin::address::NetworkChecked>> {
        if addr.chain != ChainId::Bitcoin {
            return Err(MultichainError::Validation(format!(
                "expected bitcoin address, got {}",
                addr.chain.as_str()
            )));
        }
        let unchecked = bitcoin::Address::from_str(&addr.encoded)
            .map_err(|e| MultichainError::Validation(e.to_string()))?;
        unchecked
            .require_network(self.network)
            .map_err(|e| MultichainError::Validation(e.to_string()))
    }

    fn btc_address_string(&self, addr: &Address) -> MultichainResult<String> {
        let checked = self.validate_address(addr)?;
        Ok(checked.to_string())
    }
}

#[async_trait]
impl ChainAdapter for BitcoinAdapter {
    fn name(&self) -> &str {
        "bitcoin"
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Utxo
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        let url = format!("{}/blocks/tip/height", self.api_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        if !resp.status().is_success() {
            return Ok(false);
        }
        let _height: u64 = resp
            .text()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .parse::<u64>()
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        let _ = _height;
        Ok(true)
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        let url = format!(
            "{}/api/address/{}/txs",
            self.api_url, self.deposit_address_str
        );
        let txs: Vec<MempoolAddressTx> = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        let mut events = Vec::new();
        for tx in txs {
            let mut amount = 0u64;
            let mut memo = None;
            for vout in &tx.vout {
                if vout.scriptpubkey_address.as_deref() == Some(&self.deposit_address_str) {
                    amount += vout.value;
                }
                if vout.scriptpubkey_type == "op_return" {
                    memo = extract_op_return_memo(&vout.scriptpubkey);
                }
            }
            if amount == 0 {
                continue;
            }
            let tx_hash = Hash::from_hex(&tx.txid).ok_or_else(|| {
                MultichainError::Internal(format!("invalid bitcoin txid: {}", tx.txid))
            })?;
            events.push(DepositEvent {
                chain: ChainId::Bitcoin,
                tx_hash,
                recipient: self.deposit_address.clone(),
                amount: Amount::new(amount as u128),
                memo,
                confirmations: if tx.status.confirmed { 1 } else { 0 },
            });
        }
        Ok(events)
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        let url = format!("{}/blocks/tip/height", self.api_url);
        let text = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .text()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        text.parse::<u64>()
            .map_err(|e| MultichainError::Internal(e.to_string()))
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        let txid = bitcoin::Txid::from_slice(tx_hash.as_bytes())
            .map_err(|e| MultichainError::Validation(e.to_string()))?;
        let url = format!("{}/api/tx/{}", self.api_url, txid);
        let tx = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json::<MempoolTx>()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        if !tx.status.confirmed {
            return Ok(0);
        }

        let block_height = tx.status.block_height.ok_or_else(|| {
            MultichainError::Internal("confirmed tx missing block_height".to_string())
        })?;
        let tip = self.current_height().await?;
        Ok(tip.saturating_sub(block_height) + 1)
    }

    async fn send_payment(&self, to: &Address, amount: Amount) -> MultichainResult<Hash> {
        let satoshis: u64 = amount
            .0
            .try_into()
            .map_err(|_| MultichainError::Validation("amount exceeds u64 satoshis".to_string()))?;
        if satoshis == 0 {
            return Err(MultichainError::Validation(
                "cannot send zero bitcoin amount".to_string(),
            ));
        }

        let recipient = bitcoin::Address::from_str(&to.encoded)
            .map_err(|e| MultichainError::Validation(format!("invalid bitcoin recipient: {e}")))?
            .require_network(self.network)
            .map_err(|e| MultichainError::Validation(format!("recipient network mismatch: {e}")))?;

        let utxos = self
            .client
            .get(format!(
                "{}/api/address/{}/utxo",
                self.api_url, self.deposit_address_str
            ))
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json::<Vec<MempoolUtxo>>()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        let fee_rate = self
            .client
            .get(format!("{}/v1/fees/recommended", self.api_url))
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json::<MempoolFeeEstimate>()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        let fee_per_vbyte = fee_rate.hour_fee.max(1);

        let mut selected = Vec::new();
        let mut selected_value = 0u64;
        for utxo in utxos {
            if !utxo.status.confirmed {
                continue;
            }
            selected_value += utxo.value;
            selected.push(utxo);
            let vsize = estimate_vsize(selected.len(), 2);
            let fee = fee_per_vbyte * vsize as u64;
            if selected_value >= satoshis + fee {
                break;
            }
        }

        if selected.is_empty() {
            return Err(MultichainError::Validation(
                "no confirmed UTXOs available".to_string(),
            ));
        }

        let vsize = estimate_vsize(selected.len(), 2);
        let fee = fee_per_vbyte * vsize as u64;
        let total_input: u64 = selected.iter().map(|u| u.value).sum();
        if total_input < satoshis + fee {
            return Err(MultichainError::Validation(
                "insufficient confirmed UTXO balance".to_string(),
            ));
        }

        let change = total_input - satoshis - fee;
        const DUST_LIMIT: u64 = 546;
        let mut outputs = vec![bitcoin::TxOut {
            value: bitcoin::Amount::from_sat(satoshis),
            script_pubkey: recipient.script_pubkey(),
        }];
        if change > DUST_LIMIT {
            let change_address = bitcoin::Address::from_str(&self.deposit_address_str)
                .map_err(|e| MultichainError::Internal(format!("invalid change address: {e}")))?
                .require_network(self.network)
                .map_err(|e| MultichainError::Internal(format!("change network mismatch: {e}")))?;
            outputs.push(bitcoin::TxOut {
                value: bitcoin::Amount::from_sat(change),
                script_pubkey: change_address.script_pubkey(),
            });
        }

        let mut inputs = Vec::with_capacity(selected.len());
        for utxo in &selected {
            let txid = bitcoin::Txid::from_str(&utxo.txid)
                .map_err(|e| MultichainError::Internal(format!("invalid utxo txid: {e}")))?;
            inputs.push(bitcoin::TxIn {
                previous_output: bitcoin::OutPoint::new(txid, utxo.vout),
                script_sig: bitcoin::ScriptBuf::new(),
                sequence: bitcoin::Sequence::MAX,
                witness: bitcoin::Witness::new(),
            });
        }

        let mut tx = bitcoin::Transaction {
            version: bitcoin::transaction::Version::TWO,
            lock_time: bitcoin::locktime::absolute::LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        let secp = bitcoin::secp256k1::Secp256k1::new();
        let (private_key, _public_key) = self
            .keyring
            .bitcoin_key_pair(self.network, 0, 0)
            .map_err(|e| MultichainError::Internal(format!("bitcoin key pair: {e}")))?;
        let secp_public_key = private_key.inner.public_key(&secp);

        let deposit_script = bitcoin::Address::from_str(&self.deposit_address_str)
            .map_err(|e| MultichainError::Internal(format!("invalid deposit address: {e}")))?
            .require_network(self.network)
            .map_err(|e| MultichainError::Internal(format!("deposit network mismatch: {e}")))?
            .script_pubkey();

        let mut sighasher = bitcoin::sighash::SighashCache::new(&mut tx);
        for (idx, utxo) in selected.iter().enumerate() {
            let value = bitcoin::Amount::from_sat(utxo.value);
            let sighash = sighasher
                .p2wpkh_signature_hash(
                    idx,
                    &deposit_script,
                    value,
                    bitcoin::sighash::EcdsaSighashType::All,
                )
                .map_err(|e| MultichainError::Internal(format!("sighash: {e}")))?;
            let message = bitcoin::secp256k1::Message::from_digest(sighash.to_byte_array());
            let sig = secp.sign_ecdsa(&message, &private_key.inner);
            let bitcoin_sig = bitcoin::ecdsa::Signature::sighash_all(sig);
            let witness = bitcoin::Witness::p2wpkh(&bitcoin_sig, &secp_public_key);
            *sighasher.witness_mut(idx).ok_or_else(|| {
                MultichainError::Internal("missing witness for input".to_string())
            })? = witness;
        }

        let raw_hex = bitcoin::consensus::encode::serialize_hex(&tx);
        let broadcast_url = format!("{}/api/tx", self.api_url);
        let txid = self
            .client
            .post(&broadcast_url)
            .header("Content-Type", "text/plain")
            .body(raw_hex)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .text()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        Hash::from_hex(&txid).ok_or_else(|| {
            MultichainError::Internal(format!("broadcast returned invalid txid: {txid}"))
        })
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let addr = self.btc_address_string(address)?;
        let url = format!("{}/api/address/{}/utxo", self.api_url, addr);
        let utxos = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .json::<Vec<MempoolUtxo>>()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        let total: u64 = utxos
            .into_iter()
            .filter(|u| u.status.confirmed)
            .map(|u| u.value)
            .sum();
        Ok(Amount::new(total as u128))
    }

    async fn execute_outbound(&self, transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
        self.send_payment(&transfer.target.address, transfer.target.amount)
            .await
    }
}

fn estimate_vsize(inputs: usize, outputs: usize) -> usize {
    10 + 68 * inputs + 31 * outputs
}

#[derive(Debug, Deserialize)]
struct MempoolFeeEstimate {
    #[serde(rename = "hourFee")]
    hour_fee: u64,
}

#[derive(Debug, Deserialize)]
struct MempoolUtxo {
    txid: String,
    vout: u32,
    value: u64,
    status: MempoolUtxoStatus,
}

#[derive(Debug, Deserialize)]
struct MempoolUtxoStatus {
    confirmed: bool,
}

#[derive(Debug, Deserialize)]
struct MempoolTx {
    status: MempoolTxStatus,
}

#[derive(Debug, Deserialize)]
struct MempoolTxStatus {
    confirmed: bool,
    block_height: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct MempoolAddressTx {
    txid: String,
    vout: Vec<MempoolVout>,
    status: MempoolTxStatus,
}

#[derive(Debug, Deserialize)]
struct MempoolVout {
    scriptpubkey: String,
    #[serde(rename = "scriptpubkey_type")]
    scriptpubkey_type: String,
    #[serde(rename = "scriptpubkey_address")]
    scriptpubkey_address: Option<String>,
    value: u64,
}

fn extract_op_return_memo(script_hex: &str) -> Option<String> {
    let bytes = hex::decode(script_hex.trim_start_matches("0x")).ok()?;
    if bytes.is_empty() || bytes[0] != 0x6a {
        return None;
    }
    let mut idx = 1;
    if idx >= bytes.len() {
        return None;
    }
    let len = match bytes[idx] {
        n if n <= 0x4b => {
            idx += 1;
            n as usize
        }
        0x4c if idx + 1 < bytes.len() => {
            let l = bytes[idx + 1] as usize;
            idx += 2;
            l
        }
        _ => return None,
    };
    if idx + len > bytes.len() {
        return None;
    }
    let data = &bytes[idx..idx + len];
    Some(String::from_utf8_lossy(data).into_owned())
}
