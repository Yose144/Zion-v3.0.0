//! Standalone bridge unlock submitter.
//!
//! Signs the canonical bridge operation message with the validator private
//! keys using the same `k256` crate as the V31 node, then submits
//! `submitBridgeUnlock` via TCP JSON-RPC.
//!
//! Usage:
//!   zion-bridge-unlock --recipient zion1... --amount 100000000 \
//!     --burn-id 0x... --evm-chain base --evm-tx-hash 0x... \
//!     --keys 0xkey1,0xkey2,0xkey3 --rpc 127.0.0.1:9445

use clap::Parser;
use k256::ecdsa::{SigningKey, VerifyingKey, Signature};
use k256::ecdsa::signature::{Signer as _, Verifier as _};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

#[derive(Parser, Debug)]
struct Args {
    #[arg(long)]
    recipient: String,
    #[arg(long)]
    amount: u64,
    #[arg(long)]
    burn_id: String,
    #[arg(long)]
    evm_chain: String,
    #[arg(long)]
    evm_tx_hash: String,
    /// Comma-separated hex private keys (with or without 0x prefix)
    #[arg(long)]
    keys: String,
    /// Comma-separated validator IDs (optional, defaults to validator-1, validator-2, ...)
    #[arg(long, default_value = "")]
    ids: String,
    #[arg(long, default_value = "127.0.0.1:9445")]
    rpc: String,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    // Build the canonical operation message (must match bridge_operation_message in v3_bridge.rs)
    let operation_message = format!(
        "unlock|recipient={}|amount={}|chain={}|burn_id={}|evm_tx={}",
        args.recipient, args.amount, args.evm_chain, args.burn_id, args.evm_tx_hash
    );

    println!("Operation message: {}", operation_message);

    // Parse validator keys and IDs
    let keys: Vec<String> = args.keys.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let ids: Vec<String> = if args.ids.is_empty() {
        (0..keys.len()).map(|i| format!("validator-{}", i + 1)).collect()
    } else {
        args.ids.split(',').map(|s| s.trim().to_string()).collect()
    };

    if keys.len() != ids.len() {
        anyhow::bail!("Number of keys ({}) doesn't match number of IDs ({})", keys.len(), ids.len());
    }

    // Sign with each validator key
    let mut proofs = Vec::new();
    for (i, (key_hex, validator_id)) in keys.iter().zip(ids.iter()).enumerate() {
        let pk_hex = key_hex.trim_start_matches("0x");
        let pk_bytes = hex::decode(pk_hex)?;
        let signing_key = SigningKey::from_slice(&pk_bytes)
            .map_err(|e| anyhow::anyhow!("Invalid secp256k1 private key {}: {}", i, e))?;

        // Sign the operation message (k256 hashes with SHA-256 internally via the Verifier trait)
        let signature: Signature = signing_key.sign(operation_message.as_bytes());
        let sig_bytes = signature.to_bytes();
        let sig_hex = hex::encode(sig_bytes);

        // Get compressed public key
        let verifying_key = VerifyingKey::from(&signing_key);
        let encoded_point = verifying_key.to_encoded_point(true);
        let pubkey_bytes: &[u8] = encoded_point.as_bytes();
        let pubkey_hex = hex::encode(pubkey_bytes);

        // Verify locally
        verifying_key.verify(operation_message.as_bytes(), &signature)
            .map_err(|e| anyhow::anyhow!("Local verify failed for {}: {}", validator_id, e))?;

        println!("  {}: pubkey=0x{}, sig=0x{}... — local verify OK", validator_id, pubkey_hex, &sig_hex[..20]);

        proofs.push(json!({
            "validator_id": validator_id,
            "validator_address": null,
            "validator_public_key": format!("0x{}", pubkey_hex),
            "signature": format!("0x{}", sig_hex),
            "signature_scheme": "secp256k1-ecdsa",
            "operation_message": operation_message,
            "synthetic": false,
        }));
    }

    println!("\n{} proofs generated", proofs.len());

    // Build RPC request
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitBridgeUnlock",
        "params": {
            "recipient": args.recipient,
            "amount_flowers": args.amount,
            "burn_id": args.burn_id,
            "evm_chain": args.evm_chain,
            "evm_tx_hash": args.evm_tx_hash,
            "validator_proofs": proofs,
        }
    });

    let request_str = serde_json::to_string(&rpc_request)? + "\n";
    println!("RPC request size: {} bytes", request_str.len());
    println!("Sending to {}...", args.rpc);

    // Send via TCP
    let mut stream = TcpStream::connect_timeout(
        &args.rpc.parse()?,
        Duration::from_secs(10),
    )?;
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    stream.write_all(request_str.as_bytes())?;
    drop(request_str); // flush

    // Read response — V31 RPC may send partial data
    use std::io::BufRead;
    let mut reader = std::io::BufReader::new(&stream);
    let mut response = String::new();
    reader.read_line(&mut response)?;

    println!("\n=== RPC Response ===");
    match serde_json::from_str::<Value>(&response) {
        Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
        Err(_) => println!("Raw: {}", response),
    }

    Ok(())
}
