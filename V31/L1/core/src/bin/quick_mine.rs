//! Quick solo miner: gets a template from the node, mines it, submits the block.
//!
//! Usage: quick_mine --node 127.0.0.1:9445 --miner <address> [--threads N]

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::thread;

use serde_json::{json, Value};

fn rpc_call(node: &str, method: &str, params: Value) -> Result<Value, String> {
    let mut stream = TcpStream::connect(node).map_err(|e| e.to_string())?;
    let req = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    });
    let line = serde_json::to_string(&req).unwrap() + "\n";
    stream.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    reader.read_line(&mut buf).map_err(|e| e.to_string())?;
    let resp: Value = serde_json::from_str(&buf).map_err(|e| e.to_string())?;
    if let Some(err) = resp.get("error") {
        if !err.is_null() {
            return Err(err.to_string());
        }
    }
    Ok(resp.get("result").cloned().unwrap_or(Value::Null))
}

fn main() {
    let node = std::env::var("ZION_NODE_RPC").unwrap_or_else(|_| "127.0.0.1:9445".to_string());
    let miner = std::env::var("ZION_MINER_ADDR").unwrap_or_else(|_| {
        eprintln!("Set ZION_MINER_ADDR to the miner reward address");
        std::process::exit(1);
    });
    let threads: usize = std::env::var("ZION_MINER_THREADS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);

    // Get template
    let template = rpc_call(&node, "getTemplate", json!({"miner_address": miner}))
        .expect("failed to get template");

    let height = template["height"].as_u64().unwrap();
    let difficulty = template["difficulty"].as_u64().unwrap();
    let target_hex = template["target_hex"].as_str().unwrap();
    let header_hex = template["header_hex"].as_str().unwrap();
    let transactions = template["transactions"].clone();

    eprintln!("Template: height={height}, difficulty={difficulty}, target={target_hex}");

    // Parse target (32 bytes, big-endian hex)
    let target_bytes = hex::decode(target_hex).expect("invalid target hex");
    let mut target = [0u8; 32];
    target.copy_from_slice(&target_bytes);

    // Parse header (80 bytes)
    let header_bytes = hex::decode(header_hex).expect("invalid header hex");
    let mut pow_header = [0u8; 80];
    pow_header.copy_from_slice(&header_bytes);

    // Parse header fields
    let previous_hash: [u8; 32] = pow_header[0..32].try_into().unwrap();
    let merkle_root: [u8; 32] = pow_header[32..64].try_into().unwrap();
    let hdr_height = u64::from_le_bytes(pow_header[64..72].try_into().unwrap());
    let timestamp = u64::from_le_bytes(pow_header[72..80].try_into().unwrap());

    eprintln!("Mining with {threads} threads, height={hdr_height}, timestamp={timestamp}");

    // Use the consensus engine to mine
    use zion_core::consensus::ConsensusEngine;
    use zion_core::block::{Block, BlockHeader};
    use zion_l1_types::Hash;

    let consensus = ConsensusEngine::new(std::sync::Arc::new(
        zion_cosmic_harmony::EkamDeeksha::new(),
    ));

    let mut header = BlockHeader {
        previous_hash: Hash::new(previous_hash),
        merkle_root: Hash::new(merkle_root),
        height: hdr_height,
        timestamp,
        nonce: 0,
        difficulty,
    };

    // Mine with multiple threads
    let pow_header = header.pow_header();
    let target_arc = Arc::new(target);
    let pow_header_arc = Arc::new(pow_header);
    let found = Arc::new(std::sync::Mutex::new(None));
    let running = Arc::new(std::sync::atomic::AtomicBool::new(true));

    let mut handles = Vec::new();
    for i in 0..threads {
        let pow_header = pow_header_arc.clone();
        let target = target_arc.clone();
        let found = found.clone();
        let running = running.clone();
        let start_nonce = (i as u64) * 1_000_000_000;
        let limit = 1_000_000_000u64;

        handles.push(thread::spawn(move || {
            let engine = ConsensusEngine::new(std::sync::Arc::new(
                zion_cosmic_harmony::EkamDeeksha::new(),
            ));
            let mut current_start = start_nonce;
            while running.load(std::sync::atomic::Ordering::Relaxed) {
                if let Some((nonce, hash)) = engine.mine_header_bytes(
                    &pow_header[..],
                    &target,
                    current_start,
                    limit,
                ) {
                    let mut guard = found.lock().unwrap();
                    if guard.is_none() {
                        *guard = Some((nonce, hash));
                        running.store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                    return;
                }
                current_start = current_start.wrapping_add(limit);
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let guard = found.lock().unwrap();
    let (nonce, _hash) = guard.as_ref().expect("no nonce found");
    header.nonce = *nonce;

    eprintln!("Found nonce: {nonce}");
    eprintln!("Block hash: {}", header.header_hash().to_hex());

    // Build block
    let block = Block {
        header: header.clone(),
        transactions: serde_json::from_value(transactions).expect("failed to parse transactions"),
    };

    // Submit block
    let block_json = serde_json::to_value(&block).unwrap();
    let result = rpc_call(&node, "submitBlock", block_json)
        .expect("failed to submit block");

    eprintln!("Block submitted: {result}");
    eprintln!("Block height: {}, nonce: {nonce}", header.height);
}
