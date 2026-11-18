use anyhow::{anyhow, bail, Context, Result};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

/// Send a JSON-RPC request to the ZION L1 TCP RPC and return the parsed response.
pub async fn call(rpc_url: &str, method: &str, params: Value) -> Result<Value> {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    });
    rpc_call(rpc_url, &request).await
}

/// Fetch spendable UTXOs for an address from the L1 RPC.
pub async fn fetch_utxos(
    rpc_url: &str,
    address: &str,
) -> Result<Vec<zion_core::v31_wallet::SpendableUtxo>> {
    let response = call(rpc_url, "getUtxos", serde_json::json!({"address": address})).await?;

    if let Some(err) = response["error"]["message"].as_str() {
        bail!("getUtxos error: {}", err);
    }

    let utxos = response["result"]["utxos"]
        .as_array()
        .ok_or_else(|| anyhow!("no utxos field in RPC response"))?;

    let result: Vec<zion_core::v31_wallet::SpendableUtxo> = utxos
        .iter()
        .filter_map(|u| {
            let tx_hash_hex = u["tx_hash"].as_str()?;
            let output_index = u["output_index"].as_u64()? as u32;
            let amount = u["amount"].as_u64()?;
            let tx_hash = hex::decode(tx_hash_hex).ok()?;
            if tx_hash.len() != 32 {
                return None;
            }
            let mut hash_arr = [0u8; 32];
            hash_arr.copy_from_slice(&tx_hash);
            Some(zion_core::v31_wallet::SpendableUtxo {
                tx_hash: hash_arr,
                output_index,
                amount,
                address: address.to_string(),
                script: hex::decode(u["script_hex"].as_str().unwrap_or("")).unwrap_or_default(),
                block_height: u["block_height"].as_u64().unwrap_or(0),
                is_coinbase: u["is_coinbase"].as_bool().unwrap_or(false),
            })
        })
        .collect();

    Ok(result)
}

/// Submit a signed V31 native UTXO transaction to the L1 RPC.
pub async fn submit_utxo_tx_json(rpc_url: &str, tx_json: &Value) -> Result<String> {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "submitUtxoTransaction",
        "params": {"transaction": tx_json.clone()},
        "id": 1
    });
    let response = rpc_call(rpc_url, &request).await?;

    if let Some(err) = response["error"]["message"].as_str() {
        bail!("submitUtxoTransaction error: {}", err);
    }

    let result = response["result"].to_string();
    Ok(result)
}

fn clean_rpc_url(rpc_url: &str) -> &str {
    let s = rpc_url.trim();
    let s = s
        .strip_prefix("http://")
        .or(s.strip_prefix("https://"))
        .unwrap_or(s);
    s.split_once('/').map(|(h, _)| h).unwrap_or(s)
}

/// `true` když URL míří na veřejný HTTPS JSON-RPC (nginx), ne na lokální TCP.
fn is_https(rpc_url: &str) -> bool {
    rpc_url.trim().starts_with("https://")
}

/// JSON-RPC přes HTTP(S) — veřejné `rpc.zionterranova.com/jsonrpc`.
///
/// Uživatel bez lokálního nodu nemá jak dosáhnout na `127.0.0.1:9445`;
/// dřív `rpc_call` vždy strhl schéma a zkusil plain TCP, takže `https://`
/// skončilo na TLS portu jako „expected value at line 1 column 1“.
async fn rpc_http_call(url: &str, request: &Value) -> Result<Value> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .context("failed to build RPC HTTP client")?;
    let response = client
        .post(url)
        .json(request)
        .send()
        .await
        .with_context(|| format!("failed to reach RPC at {url}"))?;
    let status = response.status();
    let body = response.text().await.context("failed to read RPC response")?;
    if !status.is_success() {
        bail!("RPC {} at {url}: {}", status.as_u16(), body.trim());
    }
    serde_json::from_str(&body).with_context(|| "failed to parse RPC response")
}

async fn rpc_call(rpc_url: &str, request: &Value) -> Result<Value> {
    if is_https(rpc_url) {
        return rpc_http_call(rpc_url.trim(), request).await;
    }
    let url = clean_rpc_url(rpc_url);
    let mut stream = TcpStream::connect(url)
        .await
        .with_context(|| format!("failed to connect to RPC at {url}"))?;

    let payload = format!("{}\n", serde_json::to_string(request)?);
    stream.write_all(payload.as_bytes()).await?;
    stream.flush().await?;

    let (reader, _) = stream.split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .with_context(|| "failed to read RPC response")?;

    serde_json::from_str(&line).with_context(|| "failed to parse RPC response")
}
