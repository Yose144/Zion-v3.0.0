//! bitcoind JSON-RPC backend — esplora-compatible surface over a pruned node.
//!
//! `WARP_BITCOIN_API` entries may carry the `bitcoind+rpc://` scheme:
//!
//! ```text
//! WARP_BITCOIN_API="bitcoind+rpc://user:pass@127.0.0.1:8332/warpwatch,https://mempool.space/api"
//! ```
//!
//! The local node is tried first; on any error the next endpoint is used
//! (identical failover semantics to plain esplora URLs). The path component is
//! the name of a *watch-only* wallet (`disable_private_keys`) — created and
//! loaded lazily. Watched addresses are auto-imported on first query with
//! `timestamp="now"` (no rescan — the node is pruned), so the backend only
//! sees transactions that arrive after the import; per-swap HTLC addresses
//! and the relay wallet satisfy this by construction (fresh addresses,
//! funded after import).
//!
//! Translated esplora surface:
//!   GET  /blocks/tip/height   → getblockcount
//!   GET  /address/{a}/txs     → listsinceblock + gettransaction(verbose)
//!   GET  /address/{a}/utxo    → listunspent (watch-only)
//!   GET  /tx/{t}/status       → gettransaction / getrawtransaction
//!   POST /tx                  → sendrawtransaction

use reqwest::Client;
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub const SCHEME: &str = "bitcoind+rpc://";

/// True when `base` selects the bitcoind RPC backend instead of plain esplora.
pub fn is_bitcoind(base: &str) -> bool {
    base.starts_with(SCHEME)
}

#[derive(Debug, Clone)]
struct BtcRpc {
    /// `http://host:port` (no auth material — passed via basic_auth).
    base: String,
    user: String,
    pass: String,
    /// Watch-only wallet name (may be empty → default wallet endpoints).
    wallet: String,
}

fn parse(base: &str) -> Result<BtcRpc, String> {
    let rest = base
        .strip_prefix(SCHEME)
        .ok_or_else(|| format!("not a {SCHEME} url"))?;
    let url =
        reqwest::Url::parse(&format!("http://{rest}")).map_err(|e| format!("url parse: {e}"))?;
    let host_str = url.host_str().ok_or("missing host")?;
    let host_str = if host_str.contains(':') && !host_str.starts_with('[') {
        format!("[{host_str}]")
    } else {
        host_str.to_string()
    };
    let mut host = format!("http://{host_str}");
    if let Some(p) = url.port() {
        host.push_str(&format!(":{p}"));
    }
    Ok(BtcRpc {
        base: host,
        user: url.username().to_string(),
        pass: url.password().unwrap_or_default().to_string(),
        wallet: url.path().trim_matches('/').to_string(),
    })
}

/// One JSON-RPC call. `wallet=true` targets `/wallet/{name}`.
async fn rpc(
    client: &Client,
    ep: &BtcRpc,
    method: &str,
    params: Value,
    wallet: bool,
) -> Result<Value, String> {
    let url = if wallet && !ep.wallet.is_empty() {
        format!("{}/wallet/{}", ep.base, ep.wallet)
    } else {
        ep.base.clone()
    };
    let body = json!({"jsonrpc": "1.0", "id": "warp", "method": method, "params": params});
    let resp = client
        .post(&url)
        .basic_auth(&ep.user, Some(&ep.pass))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("{method}: {e}"))?;
    let v: Value = resp
        .json()
        .await
        .map_err(|e| format!("{method}: decode: {e}"))?;
    if let Some(err) = v.get("error").filter(|e| !e.is_null()) {
        return Err(format!("{method}: {err}"));
    }
    Ok(v.get("result").cloned().unwrap_or(Value::Null))
}

/// Wallet-targeted RPC with lazy bootstrap: on "wallet not loaded / does not
/// exist" (-18) try `loadwallet`, then `createwallet` (disable_private_keys,
/// blank) and retry once.
async fn wallet_rpc(
    client: &Client,
    ep: &BtcRpc,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    match rpc(client, ep, method, params.clone(), true).await {
        Err(e) if e.contains("code\":-18") || e.contains("-18") => {
            // loadwallet fails with -18/-35 variants too; both paths are
            // idempotent so failures are ignored deliberately.
            let _ = rpc(client, ep, "loadwallet", json!([ep.wallet]), false).await;
            if !ep.wallet.is_empty() {
                // (name, disable_private_keys, blank, passphrase, avoid_reuse,
                //  descriptors, load_on_startup) — descriptors=true is required
                // for importdescriptors.
                let _ = rpc(
                    client,
                    ep,
                    "createwallet",
                    json!([ep.wallet, true, true, "", false, true, true]),
                    false,
                )
                .await;
            }
            rpc(client, ep, method, params, true).await
        }
        other => other,
    }
}

/// Strict parse of `WARP_BITCOIN_IMPORT_SINCE`: `None`/unset → "now"
/// (skip rescan), a unix timestamp → that value, anything else → error so a
/// typo never silently widens or skips a rescan.
fn import_timestamp(raw: Option<&str>) -> Result<Value, String> {
    match raw {
        Some(value) => value
            .trim()
            .parse::<u64>()
            .map(Value::from)
            .map_err(|_| "invalid WARP_BITCOIN_IMPORT_SINCE (expected unix timestamp)".into()),
        None => Ok(Value::from("now")),
    }
}

/// Import `addr` into the watch-only wallet via `addr()` descriptor.
/// Default `timestamp="now"` skips rescan — correct for fresh per-swap HTLC
/// addresses. `WARP_BITCOIN_IMPORT_SINCE` (unix ts) overrides it: use when an
/// address may already carry funds before its first import (e.g. the operator
/// funding wallet), so the rescan covers those txs. Imports persist in the
/// wallet file, so the timestamp matters only on first import.
/// The descriptor needs its checksum (`#xxxxxxxx`), resolved via
/// `getdescriptorinfo`. After `importdescriptors`, the postcondition is
/// verified with `getaddressinfo` — an already-imported descriptor is
/// accepted only when the address is provably watched; transport/RPC
/// failures propagate so failover can answer instead.
async fn ensure_address(client: &Client, ep: &BtcRpc, addr: &str) -> Result<(), String> {
    let info = wallet_rpc(
        client,
        ep,
        "getdescriptorinfo",
        json!([format!("addr({addr})")]),
    )
    .await?;
    let desc = info
        .get("descriptor")
        .and_then(|d| d.as_str())
        .ok_or_else(|| format!("getdescriptorinfo({addr}): no descriptor"))?
        .to_string();
    let import_since = std::env::var("WARP_BITCOIN_IMPORT_SINCE").ok();
    let timestamp = import_timestamp(import_since.as_deref())?;
    // `requests` is itself an array param → double-wrapped.
    let res = wallet_rpc(
        client,
        ep,
        "importdescriptors",
        json!([[{"desc": desc, "timestamp": timestamp, "active": false,
                "internal": false, "label": "warp"}]]),
    )
    .await?;
    let import_error = res
        .get(0)
        .and_then(|result| result.get("error"))
        .filter(|error| !error.is_null())
        .map(ToString::to_string);
    let info = wallet_rpc(client, ep, "getaddressinfo", json!([addr])).await?;
    let watched = info
        .get("iswatchonly")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || info
            .get("ismine")
            .and_then(Value::as_bool)
            .unwrap_or(false);
    if !watched {
        return Err(import_error
            .map(|error| format!("importdescriptors({addr}): {error}"))
            .unwrap_or_else(|| format!("address {addr} is not watched after import")));
    }
    Ok(())
}

/// bitcoind `type` → esplora `scriptpubkey_type` (only `op_return` is
/// consumed downstream; everything else passes through).
fn map_spk_type(t: &str) -> &str {
    match t {
        "nulldata" => "op_return",
        other => other,
    }
}

fn btc_to_sats(v: &Value) -> u64 {
    (v.as_f64().unwrap_or(0.0) * 1e8).round() as u64
}

/// Shape a `decoderawtransaction`-style object (+ confirmations context) into
/// a mempool.space `/tx` JSON object.
fn decoded_to_mempool_tx(decoded: &Value, tx_meta: &Value) -> Value {
    let confs = tx_meta
        .get("confirmations")
        .and_then(|c| c.as_i64())
        .unwrap_or(0);
    let confirmed = confs > 0;
    let vin: Vec<Value> = decoded
        .get("vin")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|i| {
            json!({
                "txid": i.get("txid"),
                "vout": i.get("vout"),
                "prevout": i.get("prevout"),
                "scriptsig_asm": i.pointer("/scriptSig/asm"),
                "witness": i.get("txinwitness"),
            })
        })
        .collect();
    let vout: Vec<Value> = decoded
        .get("vout")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|o| {
            let spk = o.get("scriptPubKey").cloned().unwrap_or(Value::Null);
            json!({
                "value": btc_to_sats(o.get("value").unwrap_or(&Value::Null)),
                "scriptpubkey": spk.get("hex"),
                "scriptpubkey_asm": spk.get("asm"),
                "scriptpubkey_address": spk.get("address"),
                "scriptpubkey_type": spk.get("type").and_then(|t| t.as_str()).map(map_spk_type),
            })
        })
        .collect();
    json!({
        "txid": decoded.get("txid"),
        "status": {
            "confirmed": confirmed,
            "block_height": tx_meta.get("blockheight"),
            "block_hash": tx_meta.get("blockhash"),
            "block_time": tx_meta.get("blocktime"),
        },
        "vin": vin,
        "vout": vout,
    })
}

/// `/address/{a}/txs` — two passes over wallet txs: keep transactions paying
/// to `a`, plus transactions spending those outputs (the spend entry's own
/// `address` field points at the *destination*, so matching must go through
/// prevout references).
async fn address_txs(client: &Client, ep: &BtcRpc, addr: &str) -> Result<String, String> {
    ensure_address(client, ep, addr).await?;
    // No params: watch-only wallets default include_watchonly=true and an
    // absent blockhash lists all known txs.
    let since = wallet_rpc(client, ep, "listsinceblock", json!([])).await?;
    let mut txids = BTreeSet::new();
    if let Some(txs) = since.get("transactions").and_then(|t| t.as_array()) {
        for t in txs {
            if let Some(id) = t.get("txid").and_then(|x| x.as_str()) {
                txids.insert(id.to_string());
            }
        }
    }
    let mut shaped = Vec::new();
    for txid in &txids {
        let meta = wallet_rpc(client, ep, "gettransaction", json!([txid, true, true])).await;
        let Ok(meta) = meta else { continue };
        let decoded = meta.get("decoded").cloned().unwrap_or(Value::Null);
        if decoded.is_null() {
            continue;
        }
        shaped.push(decoded_to_mempool_tx(&decoded, &meta));
    }
    // Outputs paying to `addr` → the set of spendable outpoints on it.
    let mut owned_outpoints = BTreeSet::new();
    for tx in &shaped {
        let txid = tx.get("txid").and_then(|t| t.as_str()).unwrap_or_default();
        if let Some(vouts) = tx.get("vout").and_then(|v| v.as_array()) {
            for (i, o) in vouts.iter().enumerate() {
                if o.get("scriptpubkey_address").and_then(|a| a.as_str()) == Some(addr) {
                    owned_outpoints.insert(format!("{txid}:{i}"));
                }
            }
        }
    }
    let filtered: Vec<&Value> = shaped
        .iter()
        .filter(|tx| {
            let pays = tx
                .get("vout")
                .and_then(|v| v.as_array())
                .map(|vs| {
                    vs.iter().any(|o| {
                        o.get("scriptpubkey_address").and_then(|a| a.as_str()) == Some(addr)
                    })
                })
                .unwrap_or(false);
            let spends = tx
                .get("vin")
                .and_then(|v| v.as_array())
                .map(|vs| {
                    vs.iter().any(|i| {
                        let key = format!(
                            "{}:{}",
                            i.get("txid").and_then(|t| t.as_str()).unwrap_or(""),
                            i.get("vout").and_then(|v| v.as_u64()).unwrap_or(u64::MAX)
                        );
                        owned_outpoints.contains(&key)
                    })
                })
                .unwrap_or(false);
            pays || spends
        })
        .collect();
    // esplora order: mempool first, then newest confirmed.
    let mut out = filtered;
    out.sort_by(|a, b| {
        let ca = a
            .pointer("/status/confirmed")
            .and_then(|c| c.as_bool())
            .unwrap_or(false);
        let cb = b
            .pointer("/status/confirmed")
            .and_then(|c| c.as_bool())
            .unwrap_or(false);
        let ha = a
            .pointer("/status/block_height")
            .and_then(|h| h.as_u64())
            .unwrap_or(0);
        let hb = b
            .pointer("/status/block_height")
            .and_then(|h| h.as_u64())
            .unwrap_or(0);
        (cb, hb).cmp(&(ca, ha))
    });
    serde_json::to_string(&out).map_err(|e| e.to_string())
}

/// `/address/{a}/utxo` — watch-only `listunspent` (minconf 0 so mempool
/// outputs show with `confirmed:false`, matching esplora).
async fn address_utxos(client: &Client, ep: &BtcRpc, addr: &str) -> Result<String, String> {
    ensure_address(client, ep, addr).await?;
    let unspent = wallet_rpc(
        client,
        ep,
        "listunspent",
        json!([0, 9999999, [addr], true]),
    )
    .await?;
    let utxos: Vec<Value> = unspent
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|u| {
            let confs = u.get("confirmations").and_then(|c| c.as_i64()).unwrap_or(0);
            json!({
                "txid": u.get("txid"),
                "vout": u.get("vout"),
                "value": btc_to_sats(u.get("amount").unwrap_or(&Value::Null)),
                "status": { "confirmed": confs > 0 },
            })
        })
        .collect();
    serde_json::to_string(&utxos).map_err(|e| e.to_string())
}

/// `/tx/{t}/status` — wallet first, then raw-mempool lookup. Unknown txids
/// are an error so failover can answer from a backend that knows the tx.
async fn tx_status(client: &Client, ep: &BtcRpc, txid: &str) -> Result<String, String> {
    if let Ok(meta) = wallet_rpc(client, ep, "gettransaction", json!([txid, true])).await {
        let confs = meta
            .get("confirmations")
            .and_then(|c| c.as_i64())
            .unwrap_or(0);
        let mut height = meta.get("blockheight").and_then(|h| h.as_u64());
        if confs > 0 && height.is_none() {
            if let Ok(tip) = rpc(client, ep, "getblockcount", json!([]), false).await {
                height = tip
                    .as_u64()
                    .map(|t| t.saturating_sub(confs as u64).saturating_add(1));
            }
        }
        return serde_json::to_string(&json!({
            "confirmed": confs > 0,
            "block_height": height,
            "block_hash": meta.get("blockhash"),
            "block_time": meta.get("blocktime"),
        }))
        .map_err(|e| e.to_string());
    }
    // Not a wallet tx — try raw mempool (no txindex on pruned node).
    let raw = rpc(client, ep, "getrawtransaction", json!([txid, true]), false).await?;
    let confs = raw.get("confirmations").and_then(|c| c.as_i64()).unwrap_or(0);
    serde_json::to_string(&json!({
        "confirmed": confs > 0,
        "block_height": raw.get("blockheight"),
        "block_hash": raw.get("blockhash"),
        "block_time": raw.get("blocktime"),
    }))
    .map_err(|e| e.to_string())
}

/// GET `path` against `base`: dispatch on scheme — bitcoind RPC translation
/// or plain esplora HTTP. Returns the response body (text/JSON string).
pub async fn backend_get(client: &Client, base: &str, path: &str) -> Result<String, String> {
    if !is_bitcoind(base) {
        let url = format!("{base}{path}");
        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("request failed: {}", e.without_url()))?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }
        return resp
            .text()
            .await
            .map_err(|e| format!("response body failed: {}", e.without_url()));
    }
    let ep = parse(base)?;
    if path == "/blocks/tip/height" {
        let v = rpc(client, &ep, "getblockcount", json!([]), false).await?;
        return v
            .as_u64()
            .map(|h| h.to_string())
            .ok_or_else(|| "getblockcount: not a number".into());
    }
    if let Some(addr) = path
        .strip_prefix("/address/")
        .and_then(|s| s.strip_suffix("/txs"))
    {
        return address_txs(client, &ep, addr).await;
    }
    if let Some(addr) = path
        .strip_prefix("/address/")
        .and_then(|s| s.strip_suffix("/utxo"))
    {
        return address_utxos(client, &ep, addr).await;
    }
    if let Some(txid) = path
        .strip_prefix("/tx/")
        .and_then(|s| s.strip_suffix("/status"))
    {
        return tx_status(client, &ep, txid).await;
    }
    Err(format!("unsupported bitcoind path: {path}"))
}

/// Ensure a bitcoind watch-only wallet tracks `address` before funds move.
/// No-op for plain esplora endpoints (no wallet to prime). Fails closed on
/// transport/RPC errors so callers cannot fund an unwatched HTLC address.
pub(crate) async fn backend_watch_address(
    client: &Client,
    base: &str,
    address: &str,
) -> Result<(), String> {
    if !is_bitcoind(base) {
        return Ok(());
    }
    let ep = parse(base)?;
    ensure_address(client, &ep, address).await
}

/// POST raw tx hex (`/tx`) — `sendrawtransaction` on bitcoind, plain POST
/// on esplora. Returns the txid.
pub async fn backend_post_tx(
    client: &Client,
    base: &str,
    raw_hex: &str,
) -> Result<String, String> {
    if !is_bitcoind(base) {
        let url = format!("{base}/tx");
        let resp = client
            .post(&url)
            .header("Content-Type", "text/plain")
            .body(raw_hex.to_string())
            .send()
            .await
            .map_err(|e| format!("request failed: {}", e.without_url()))?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("broadcast HTTP {status}"));
        }
        return Ok(body.trim().to_string());
    }
    let ep = parse(base)?;
    let v = rpc(
        client,
        &ep,
        "sendrawtransaction",
        json!([raw_hex]),
        false,
    )
    .await?;
    v.as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("sendrawtransaction: bad result {v}"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheme_detection() {
        assert!(is_bitcoind("bitcoind+rpc://u:p@127.0.0.1:8332/w"));
        assert!(!is_bitcoind("https://mempool.space/api"));
    }

    #[test]
    fn parse_url_with_wallet() {
        let ep = parse("bitcoind+rpc://alice:secret@127.0.0.1:8332/warpwatch").unwrap();
        assert_eq!(ep.base, "http://127.0.0.1:8332");
        assert_eq!(ep.user, "alice");
        assert_eq!(ep.pass, "secret");
        assert_eq!(ep.wallet, "warpwatch");
    }

    #[test]
    fn parse_url_no_wallet() {
        let ep = parse("bitcoind+rpc://u:p@[::1]:8332").unwrap();
        assert_eq!(ep.base, "http://[::1]:8332");
        assert_eq!(ep.wallet, "");
    }

    #[test]
    fn parse_rejects_esplora() {
        assert!(parse("https://mempool.space/api").is_err());
    }

    #[test]
    fn decoded_tx_shapes_esplora_json() {
        let decoded = json!({
            "txid": "aa11",
            "vin": [{
                "txid": "bb22", "vout": 0,
                "scriptSig": {"asm": ""},
                "txinwitness": ["3044", "02ab"]
            }],
            "vout": [{
                "value": 0.00010546, "n": 0,
                "scriptPubKey": {
                    "asm": "0 ccdd", "hex": "0020ccdd",
                    "type": "witness_v0_scripthash",
                    "address": "tb1qhtlc"
                }
            }, {
                "value": 0.0, "n": 1,
                "scriptPubKey": {"asm": "OP_RETURN 6a", "hex": "6a", "type": "nulldata"}
            }]
        });
        let meta = json!({"confirmations": 3, "blockheight": 100, "blockhash": "ff", "blocktime": 7});
        let tx = decoded_to_mempool_tx(&decoded, &meta);
        assert_eq!(tx["txid"], "aa11");
        assert_eq!(tx["status"]["confirmed"], true);
        assert_eq!(tx["status"]["block_height"], 100);
        assert_eq!(tx["vin"][0]["txid"], "bb22");
        assert_eq!(tx["vin"][0]["witness"][0], "3044");
        assert_eq!(tx["vout"][0]["value"], 10546);
        assert_eq!(tx["vout"][0]["scriptpubkey"], "0020ccdd");
        assert_eq!(tx["vout"][0]["scriptpubkey_address"], "tb1qhtlc");
        assert_eq!(tx["vout"][1]["scriptpubkey_type"], "op_return");
    }

    #[test]
    fn btc_to_sats_rounding() {
        assert_eq!(btc_to_sats(&json!(0.00010546)), 10546);
        assert_eq!(btc_to_sats(&json!(1.0)), 100_000_000);
        assert_eq!(btc_to_sats(&Value::Null), 0);
    }

    #[test]
    fn spk_type_mapping() {
        assert_eq!(map_spk_type("nulldata"), "op_return");
        assert_eq!(map_spk_type("witness_v0_scripthash"), "witness_v0_scripthash");
    }

    #[test]
    fn import_timestamp_is_strict() {
        assert_eq!(import_timestamp(None).unwrap(), Value::from("now"));
        assert_eq!(import_timestamp(Some("12345")).unwrap(), Value::from(12345u64));
        assert!(import_timestamp(Some("not-a-time")).is_err());
        assert!(import_timestamp(Some("")).is_err());
    }

    #[tokio::test]
    async fn plain_backend_errors_redact_url_credentials() {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(2))
            .build()
            .unwrap();
        // Connection refused on port 1 — the error must not carry userinfo.
        let base = "http://test-user:test-secret@127.0.0.1:1";
        let err = backend_get(&client, base, "/blocks/tip/height")
            .await
            .unwrap_err();
        assert!(!err.contains("test-user"), "leaked user: {err}");
        assert!(!err.contains("test-secret"), "leaked secret: {err}");

        let err = backend_post_tx(&client, base, "deadbeef").await.unwrap_err();
        assert!(!err.contains("test-user"), "leaked user: {err}");
        assert!(!err.contains("test-secret"), "leaked secret: {err}");
    }
}
