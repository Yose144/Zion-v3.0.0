//! L1 hash anchoring for the DeSci papers repository.
//!
//! Every paper carries a blake3 content hash (`papers.content_sha256`). The
//! anchor writes that hash into an L1 transaction memo so the paper's
//! existence and integrity are timestamped by the chain:
//!
//! * `memo-direct`  — one tx per paper, memo `ISSPAPER:v1:<hash-hex>`,
//!   dust output to the sentinel address. MVP for low volume (<10/day).
//! * `merkle-batch` — pending papers are folded into a blake3 merkle tree;
//!   one tx carries `ISSANCHOR:v1:<root-hex>` and each paper stores its
//!   `merkle_path` proof. One tx/day regardless of volume.
//!
//! Signing uses the ops key pair `ISS_ANCHOR_KEY` (hex Ed25519) +
//! `ISS_ANCHOR_ADDRESS` (source/change) — same custody pattern as
//! `ZION_DAO_TREASURY_KEY`. Without a configured key the sweep is a no-op:
//! papers stay `submitted`/`pending_anchor` (fail-closed, vzor
//! `awaiting_broadcast` z `treasury_tx.rs`).
//!
//! Confirmation is reorg-safe: a tx counts as anchored only after
//! `finality_blocks` confirmations. Primary check = `getUtxos` on the
//! sentinel address; fallback = bounded `getBlockByHeight` scan (the anchor
//! dust output can itself be spent by a later anchor tx when sentinel ==
//! anchor wallet).

use crate::db::{AnchorBatchRecord, IssobellaDb, PaperRecord};
use crate::error::{IssobellaError, IssobellaResult};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tracing::{info, warn};

/// Memo prefix for a single-paper anchor.
pub const MEMO_PREFIX: &str = "ISSPAPER:v1:";
/// Memo prefix for a merkle-batch anchor.
pub const BATCH_MEMO_PREFIX: &str = "ISSANCHOR:v1:";
/// Fixed protocol fee for an anchor tx (1 ZION — same as treasury spends).
pub const DEFAULT_ANCHOR_FEE_FLOWERS: u64 = 1_000_000;
/// Dust amount sent to the sentinel (tx amount must be > 0).
pub const DEFAULT_ANCHOR_DUST_FLOWERS: u64 = 1;
/// Blocks the confirm phase scans backwards when the sentinel UTXO is gone.
pub const DEFAULT_CONFIRM_SCAN_LOOKBACK: u64 = 512;
/// Auto mode picks `batch` when more than this many papers are pending.
pub const AUTO_BATCH_THRESHOLD: usize = 10;

/// Coinbase maturity used when filtering spendable anchor UTXOs.
const COINBASE_MATURITY: u64 = 100;

#[derive(Clone)]
pub struct AnchorConfig {
    pub rpc_addr: String,
    /// Anchor wallet address — tx source + change.
    pub from_address: Option<String>,
    pub key: Option<ed25519_dalek::SigningKey>,
    /// Output the anchor dust lands on. Defaults to `from_address` when the
    /// env is unset (self-dust — the memo is the payload, the output is a
    /// fee vehicle).
    pub sentinel: String,
    pub fee_flowers: u64,
    pub dust_flowers: u64,
    pub finality_blocks: u64,
    pub confirm_scan_lookback: u64,
}

impl AnchorConfig {
    pub fn configured(&self) -> bool {
        self.key.is_some() && self.from_address.is_some()
    }
}

pub fn anchor_config(rpc_url: &str) -> AnchorConfig {
    let key = std::env::var("ISS_ANCHOR_KEY").ok().and_then(|raw| {
        let bytes = hex::decode(raw.trim().trim_start_matches("0x")).ok()?;
        let arr: [u8; 32] = bytes.try_into().ok()?;
        Some(ed25519_dalek::SigningKey::from_bytes(&arr))
    });
    let from_address = std::env::var("ISS_ANCHOR_ADDRESS")
        .ok()
        .filter(|a| !a.is_empty());
    let sentinel = std::env::var("ISS_ANCHOR_SENTINEL")
        .ok()
        .filter(|a| !a.is_empty())
        .or_else(|| from_address.clone())
        .unwrap_or_default();
    AnchorConfig {
        rpc_addr: rpc_url.to_string(),
        from_address,
        key,
        sentinel,
        fee_flowers: env_u64("ISS_ANCHOR_FEE_FLOWERS", DEFAULT_ANCHOR_FEE_FLOWERS),
        dust_flowers: env_u64("ISS_ANCHOR_DUST_FLOWERS", DEFAULT_ANCHOR_DUST_FLOWERS),
        finality_blocks: env_u64("ISS_ANCHOR_FINALITY", 6),
        confirm_scan_lookback: env_u64(
            "ISS_ANCHOR_CONFIRM_LOOKBACK",
            DEFAULT_CONFIRM_SCAN_LOOKBACK,
        ),
    }
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

// ── Memos ──

pub fn memo_for_paper(content_sha256: &str) -> Vec<u8> {
    format!("{}{}", MEMO_PREFIX, content_sha256).into_bytes()
}

pub fn memo_for_batch(root: &[u8; 32]) -> Vec<u8> {
    format!("{}{}", BATCH_MEMO_PREFIX, hex::encode(root)).into_bytes()
}

// ── Merkle tree (blake3, canonical L1 hash) ──

fn b3(data: &[u8]) -> [u8; 32] {
    *blake3::hash(data).as_bytes()
}

fn leaf_hash(content_sha256: &str) -> Option<[u8; 32]> {
    let bytes = hex::decode(content_sha256).ok()?;
    bytes.try_into().ok()
}

/// Pairwise blake3 merkle root. Odd leaf counts promote the last node
/// unchanged. Leaves must be raw 32-byte digests (not re-hashed).
pub fn merkle_root(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.is_empty() {
        return [0u8; 32];
    }
    let mut level: Vec<[u8; 32]> = leaves.to_vec();
    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            if pair.len() == 2 {
                let mut data = [0u8; 64];
                data[..32].copy_from_slice(&pair[0]);
                data[32..].copy_from_slice(&pair[1]);
                next.push(b3(&data));
            } else {
                next.push(pair[0]);
            }
        }
        level = next;
    }
    level[0]
}

/// One step of a merkle proof: the sibling digest and which side it sits on.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PathStep {
    pub sibling: String,
    /// "left" = sibling is the left half of the pair, "right" = right half.
    pub side: String,
}

/// Inclusion proof for `leaves[index]` — same construction as `merkle_root`.
pub fn merkle_path(leaves: &[[u8; 32]], index: usize) -> Option<Vec<PathStep>> {
    if index >= leaves.len() || leaves.is_empty() {
        return None;
    }
    let mut path = Vec::new();
    let mut level: Vec<[u8; 32]> = leaves.to_vec();
    let mut idx = index;
    while level.len() > 1 {
        if idx % 2 == 0 {
            if idx + 1 < level.len() {
                path.push(PathStep {
                    sibling: hex::encode(level[idx + 1]),
                    side: "right".to_string(),
                });
            }
            // Odd tail node promotes unchanged — no sibling to record.
        } else {
            path.push(PathStep {
                sibling: hex::encode(level[idx - 1]),
                side: "left".to_string(),
            });
        }
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            if pair.len() == 2 {
                let mut data = [0u8; 64];
                data[..32].copy_from_slice(&pair[0]);
                data[32..].copy_from_slice(&pair[1]);
                next.push(b3(&data));
            } else {
                next.push(pair[0]);
            }
        }
        level = next;
        idx /= 2;
    }
    Some(path)
}

/// Replay a proof: `leaf` + `path` must fold to `root`.
pub fn verify_merkle_path(leaf: &[u8; 32], path: &[PathStep], root: &[u8; 32]) -> bool {
    let mut cur = *leaf;
    for step in path {
        let sib: [u8; 32] = match hex::decode(&step.sibling)
            .ok()
            .and_then(|b| b.try_into().ok())
        {
            Some(s) => s,
            None => return false,
        };
        let mut data = [0u8; 64];
        if step.side == "left" {
            data[..32].copy_from_slice(&sib);
            data[32..].copy_from_slice(&cur);
        } else {
            data[..32].copy_from_slice(&cur);
            data[32..].copy_from_slice(&sib);
        }
        cur = b3(&data);
    }
    &cur == root
}

// ── L1 RPC (line-delimited TCP JSON-RPC — same transport as L1Scanner) ──

fn normalize_rpc_addr(raw: &str) -> String {
    raw.trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_start_matches("tcp://")
        .split('/')
        .next()
        .unwrap_or(raw)
        .to_string()
}

async fn rpc(addr: &str, method: &str, params: Value) -> IssobellaResult<Value> {
    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })
    .to_string();

    let target = normalize_rpc_addr(addr);
    let mut stream = TcpStream::connect(&target)
        .await
        .map_err(|e| IssobellaError::L1Rpc(format!("connect: {}", e)))?;
    stream
        .write_all(request.as_bytes())
        .await
        .map_err(|e| IssobellaError::L1Rpc(format!("write: {}", e)))?;
    stream
        .write_all(b"\n")
        .await
        .map_err(|e| IssobellaError::L1Rpc(format!("newline: {}", e)))?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .map_err(|e| IssobellaError::L1Rpc(format!("read: {}", e)))?;

    let resp: Value = serde_json::from_str(line.trim())
        .map_err(|e| IssobellaError::L1Rpc(format!("parse: {}", e)))?;
    if let Some(err) = resp.get("error").filter(|e| !e.is_null()) {
        return Err(IssobellaError::L1Rpc(format!("{}: {}", method, err)));
    }
    Ok(resp.get("result").cloned().unwrap_or(Value::Null))
}

async fn chain_tip(addr: &str) -> IssobellaResult<u64> {
    let r = rpc(addr, "getChainInfo", json!({})).await?;
    r.get("chain_height")
        .and_then(Value::as_u64)
        .ok_or_else(|| IssobellaError::L1Rpc("getChainInfo missing chain_height".into()))
}

#[derive(Debug, Deserialize)]
struct RpcUtxo {
    tx_hash: String,
    output_index: u32,
    amount: u64,
    #[serde(default)]
    is_coinbase: bool,
    #[serde(default)]
    block_height: u64,
}

async fn fetch_utxos(addr: &str, address: &str) -> IssobellaResult<Vec<RpcUtxo>> {
    let r = rpc(addr, "getUtxos", json!({ "address": address })).await?;
    let list = r
        .get("utxos")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for u in list {
        match serde_json::from_value::<RpcUtxo>(u) {
            Ok(u) => out.push(u),
            Err(e) => warn!("[ISS-ANCHOR] skipping malformed utxo: {}", e),
        }
    }
    Ok(out)
}

#[derive(Debug, Deserialize)]
struct BlockTx {
    #[serde(default, alias = "id")]
    tx_id: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct BlockScan {
    #[serde(default, alias = "utxo_transactions")]
    transactions: Vec<BlockTx>,
}

/// Scan blocks `tip-lookback..=tip` for `txid`, return its height.
/// Handles both hex-string `tx_id` and byte-array `id` serializations.
async fn find_tx_height(
    addr: &str,
    txid: &str,
    tip: u64,
    lookback: u64,
) -> IssobellaResult<Option<u64>> {
    let from = tip.saturating_sub(lookback);
    for h in (from..=tip).rev() {
        let r = rpc(addr, "getBlockByHeight", json!({ "height": h })).await;
        let Ok(result) = r else { continue };
        if result.is_null() {
            continue;
        }
        let Ok(block) = serde_json::from_value::<BlockScan>(result) else {
            continue;
        };
        for tx in &block.transactions {
            let id = match &tx.tx_id {
                Some(Value::String(s)) => Some(s.clone()),
                Some(Value::Array(bytes)) => {
                    let raw: Vec<u8> = bytes
                        .iter()
                        .filter_map(Value::as_u64)
                        .map(|b| b as u8)
                        .collect();
                    if raw.len() == 32 {
                        Some(hex::encode(raw))
                    } else {
                        None
                    }
                }
                _ => None,
            };
            if id.as_deref() == Some(txid) {
                return Ok(Some(h));
            }
        }
    }
    Ok(None)
}

// ── Sweep ──

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnchorMode {
    Memo,
    Batch,
    /// Memo up to AUTO_BATCH_THRESHOLD pending papers, batch above.
    Auto,
}

impl AnchorMode {
    pub fn parse(s: &str) -> Self {
        match s {
            "memo" | "memo-direct" => Self::Memo,
            "batch" | "merkle-batch" => Self::Batch,
            _ => Self::Auto,
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct AnchorSweepReport {
    pub configured: bool,
    pub mode: String,
    pub broadcast: usize,
    pub confirmed: usize,
    pub failed: usize,
    pub pending: usize,
    pub tip_height: Option<u64>,
    pub details: Vec<Value>,
}

/// Build + sign + submit one anchor tx carrying `memo`. Returns the txid.
async fn submit_anchor_tx(cfg: &AnchorConfig, memo: &[u8]) -> IssobellaResult<String> {
    let (key, from) = match (&cfg.key, &cfg.from_address) {
        (Some(k), Some(f)) => (k, f),
        _ => {
            return Err(IssobellaError::Other(
                "anchor wallet not configured (ISS_ANCHOR_KEY/ISS_ANCHOR_ADDRESS)".into(),
            ))
        }
    };

    let tip = chain_tip(&cfg.rpc_addr).await?;
    let utxos = fetch_utxos(&cfg.rpc_addr, from).await?;
    let spendable: Vec<zion_core::v31_wallet::SpendableUtxo> = utxos
        .iter()
        .filter(|u| !u.is_coinbase || u.block_height + COINBASE_MATURITY <= tip)
        .filter_map(|u| {
            let raw = hex::decode(&u.tx_hash).ok()?;
            let arr: [u8; 32] = raw.try_into().ok()?;
            Some(zion_core::v31_wallet::SpendableUtxo {
                tx_hash: arr,
                output_index: u.output_index,
                amount: u.amount,
                address: from.clone(),
                script: vec![],
                block_height: u.block_height,
                is_coinbase: u.is_coinbase,
            })
        })
        .collect();

    let built = zion_core::v31_wallet::build_send_with_memo(
        key,
        from,
        &cfg.sentinel,
        cfg.dust_flowers,
        cfg.fee_flowers,
        &spendable,
        memo,
    )
    .map_err(|e| IssobellaError::Other(format!("anchor tx build: {:?}", e)))?;

    let tx_json = serde_json::to_value(&built.transaction)?;
    let resp = rpc(
        &cfg.rpc_addr,
        "submitUtxoTransaction",
        json!({ "transaction": tx_json }),
    )
    .await?;
    let txid = resp
        .get("tx_id")
        .or_else(|| resp.get("txid"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| built.transaction.hash().to_hex());
    Ok(txid)
}

/// Height where `txid` is confirmed: sentinel UTXO first, block scan second.
async fn confirmed_height(cfg: &AnchorConfig, txid: &str, tip: u64) -> Option<u64> {
    if let Ok(utxos) = fetch_utxos(&cfg.rpc_addr, &cfg.sentinel).await {
        if let Some(u) = utxos.iter().find(|u| u.tx_hash == txid) {
            return Some(u.block_height);
        }
    }
    // The dust output may already be spent (self-dust mode) — scan blocks.
    find_tx_height(&cfg.rpc_addr, txid, tip, cfg.confirm_scan_lookback)
        .await
        .ok()
        .flatten()
}

/// One admin/cron-triggered anchor sweep:
/// 1) confirm `anchoring` papers/batches that reached finality,
/// 2) broadcast anchors for `submitted` papers (when the wallet is set).
pub async fn run_anchor_sweep(
    db: &Mutex<IssobellaDb>,
    cfg: &AnchorConfig,
    mode: AnchorMode,
) -> IssobellaResult<AnchorSweepReport> {
    let mut report = AnchorSweepReport {
        configured: cfg.configured(),
        mode: format!("{:?}", mode).to_lowercase(),
        broadcast: 0,
        confirmed: 0,
        failed: 0,
        pending: 0,
        tip_height: None,
        details: Vec::new(),
    };

    let tip = match chain_tip(&cfg.rpc_addr).await {
        Ok(t) => t,
        Err(e) => {
            warn!("[ISS-ANCHOR] chain tip unreachable: {}", e);
            report.details.push(json!({ "error": e.to_string() }));
            return Ok(report);
        }
    };
    report.tip_height = Some(tip);

    // ── Phase 1: confirm ──
    let anchoring: Vec<PaperRecord> = {
        let db = db.lock().unwrap();
        db.list_papers_any(&["anchoring"])?
    };
    for paper in anchoring {
        let Some(txid) = paper.anchor_txid.clone() else {
            continue;
        };
        let height = if let Some(batch_id) = batch_id_of(&paper) {
            // Batch paper confirms through its batch row.
            confirm_batch_height(db, cfg, &batch_id, &txid, tip).await
        } else {
            confirmed_height(cfg, &txid, tip).await
        };
        match height {
            Some(h) if tip >= h + cfg.finality_blocks => {
                let db = db.lock().unwrap();
                db.mark_paper_anchored(&paper.id, h as i64)?;
                report.confirmed += 1;
                info!("[ISS-ANCHOR] paper {} anchored @{}", paper.id, h);
            }
            Some(_) => report
                .details
                .push(json!({ "id": paper.id, "status": "awaiting_finality" })),
            None => report
                .details
                .push(json!({ "id": paper.id, "status": "tx_not_found", "txid": txid })),
        }
    }

    // ── Phase 2: broadcast new anchors ──
    let submitted: Vec<PaperRecord> = {
        let db = db.lock().unwrap();
        db.list_papers_any(&["submitted"])?
    };
    if submitted.is_empty() {
        return Ok(report);
    }
    if !cfg.configured() {
        report.pending = submitted.len();
        report.details.push(json!({
            "status": "pending_anchor",
            "count": submitted.len(),
            "reason": "ISS_ANCHOR_KEY/ISS_ANCHOR_ADDRESS not configured",
        }));
        return Ok(report);
    }

    let effective = match mode {
        AnchorMode::Auto => {
            if submitted.len() > AUTO_BATCH_THRESHOLD {
                AnchorMode::Batch
            } else {
                AnchorMode::Memo
            }
        }
        m => m,
    };
    report.mode = format!("{:?}", effective).to_lowercase();

    match effective {
        AnchorMode::Memo => {
            for paper in &submitted {
                let memo = memo_for_paper(&paper.content_sha256);
                match submit_anchor_tx(cfg, &memo).await {
                    Ok(txid) => {
                        let db = db.lock().unwrap();
                        db.set_paper_anchor_submitted(&paper.id, &txid, "memo-direct", None)?;
                        report.broadcast += 1;
                        info!("[ISS-ANCHOR] paper {} → tx {}", paper.id, txid);
                    }
                    Err(e) => {
                        warn!("[ISS-ANCHOR] paper {} submit failed: {}", paper.id, e);
                        report.failed += 1;
                        report.details.push(
                            json!({ "id": paper.id, "status": "submit_failed", "error": e.to_string() }),
                        );
                    }
                }
            }
        }
        AnchorMode::Batch => {
            // Leaves in deterministic order (created_at ASC from the query).
            let leaves: Vec<[u8; 32]> = submitted
                .iter()
                .filter_map(|p| leaf_hash(&p.content_sha256))
                .collect();
            if leaves.len() != submitted.len() {
                report.failed += submitted.len() - leaves.len();
                report.details.push(json!({
                    "status": "skipped",
                    "reason": "papers with malformed content_sha256 (not 64-hex)",
                }));
            }
            if !leaves.is_empty() {
                let root = merkle_root(&leaves);
                let batch_id = format!(
                    "iss-{}-{}",
                    Utc::now().format("%Y%m%d"),
                    &hex::encode(root)[..8]
                );
                let memo = memo_for_batch(&root);
                match submit_anchor_tx(cfg, &memo).await {
                    Ok(txid) => {
                        let db = db.lock().unwrap();
                        db.insert_anchor_batch(&AnchorBatchRecord {
                            batch_id: batch_id.clone(),
                            merkle_root: hex::encode(root),
                            paper_count: leaves.len() as i64,
                            anchor_txid: Some(txid.clone()),
                            anchor_height: None,
                            created_at: Utc::now(),
                        })?;
                        for (i, leaf) in leaves.iter().enumerate() {
                            // Match papers to leaves by content hash — all
                            // `submitted` papers whose hash parsed go in.
                            let Some(paper) = submitted
                                .iter()
                                .find(|p| leaf_hash(&p.content_sha256).as_ref() == Some(leaf))
                            else {
                                continue;
                            };
                            let path = merkle_path(&leaves, i)
                                .map(|p| serde_json::to_string(&p).unwrap_or_default());
                            db.set_paper_anchor_submitted(
                                &paper.id,
                                &txid,
                                &format!("merkle-batch:{}", batch_id),
                                path.as_deref(),
                            )?;
                        }
                        report.broadcast += 1;
                        info!(
                            "[ISS-ANCHOR] batch {} ({} papers) → tx {}",
                            batch_id,
                            leaves.len(),
                            txid
                        );
                    }
                    Err(e) => {
                        warn!("[ISS-ANCHOR] batch submit failed: {}", e);
                        report.failed += 1;
                        report.details.push(
                            json!({ "status": "batch_submit_failed", "error": e.to_string() }),
                        );
                    }
                }
            }
        }
        AnchorMode::Auto => unreachable!("auto resolved above"),
    }

    let db = db.lock().unwrap();
    report.pending = db.list_papers_any(&["submitted"])?.len();
    Ok(report)
}

fn batch_id_of(paper: &PaperRecord) -> Option<String> {
    paper
        .anchor_mode
        .as_deref()
        .and_then(|m| m.strip_prefix("merkle-batch:"))
        .map(str::to_string)
}

/// Confirm a batch anchor tx; when finalized, stamp the batch row so member
/// papers can copy the height.
async fn confirm_batch_height(
    db: &Mutex<IssobellaDb>,
    cfg: &AnchorConfig,
    batch_id: &str,
    txid: &str,
    tip: u64,
) -> Option<u64> {
    let height = confirmed_height(cfg, txid, tip).await?;
    if tip >= height + cfg.finality_blocks {
        let db = db.lock().unwrap();
        let _ = db.mark_anchor_batch_anchored(batch_id, height as i64);
    }
    Some(height)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h(seed: u8) -> [u8; 32] {
        [seed; 32]
    }

    #[test]
    fn memo_formats() {
        assert_eq!(memo_for_paper("ab12"), b"ISSPAPER:v1:ab12");
        assert_eq!(
            memo_for_batch(&h(7)),
            format!("ISSANCHOR:v1:{}", hex::encode(h(7))).into_bytes()
        );
    }

    #[test]
    fn merkle_single_leaf() {
        assert_eq!(merkle_root(&[h(1)]), h(1));
        assert_eq!(merkle_root(&[]), [0u8; 32]);
    }

    #[test]
    fn merkle_two_leaves() {
        let mut data = [0u8; 64];
        data[..32].copy_from_slice(&h(1));
        data[32..].copy_from_slice(&h(2));
        assert_eq!(merkle_root(&[h(1), h(2)]), b3(&data));
    }

    #[test]
    fn merkle_odd_promotes_last() {
        // [a,b] fold; c promotes unchanged → root = b3(b3(a||b) || c)
        let mut ab = [0u8; 64];
        ab[..32].copy_from_slice(&h(1));
        ab[32..].copy_from_slice(&h(2));
        let ab_h = b3(&ab);
        let mut top = [0u8; 64];
        top[..32].copy_from_slice(&ab_h);
        top[32..].copy_from_slice(&h(3));
        assert_eq!(merkle_root(&[h(1), h(2), h(3)]), b3(&top));
    }

    #[test]
    fn merkle_path_replays_to_root() {
        let leaves: Vec<[u8; 32]> = (1u8..=7).map(h).collect();
        let root = merkle_root(&leaves);
        for i in 0..leaves.len() {
            let path = merkle_path(&leaves, i).unwrap();
            assert!(
                verify_merkle_path(&leaves[i], &path, &root),
                "leaf {} proof must verify",
                i
            );
        }
        // Tampered leaf must NOT verify.
        let path = merkle_path(&leaves, 0).unwrap();
        assert!(!verify_merkle_path(&h(9), &path, &root));
    }

    #[test]
    fn merkle_path_odd_count() {
        let leaves: Vec<[u8; 32]> = (1u8..=5).map(h).collect();
        let root = merkle_root(&leaves);
        for i in 0..leaves.len() {
            let path = merkle_path(&leaves, i).unwrap();
            assert!(verify_merkle_path(&leaves[i], &path, &root));
        }
    }

    #[test]
    fn leaf_hash_validates_hex32() {
        assert!(leaf_hash(&hex::encode(h(5))).is_some());
        assert!(leaf_hash("xyz").is_none());
        assert!(leaf_hash("abcd").is_none());
    }

    #[test]
    fn anchor_mode_parses() {
        assert_eq!(AnchorMode::parse("memo"), AnchorMode::Memo);
        assert_eq!(AnchorMode::parse("batch"), AnchorMode::Batch);
        assert_eq!(AnchorMode::parse("merkle-batch"), AnchorMode::Batch);
        assert_eq!(AnchorMode::parse("whatever"), AnchorMode::Auto);
    }
}
