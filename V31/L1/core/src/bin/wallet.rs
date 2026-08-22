//! ZION L1 Wallet CLI — key management, balance queries, send, and bridge lock.
//!
//! Usage:
//!   wallet info                             — show address from signing key
//!   wallet balance [address]                — query UTXO balance (default: own address)
//!   wallet utxos   [address]                — list spendable UTXOs
//!   wallet send    <to> <amount_zion>       — send ZION
//!   wallet bridge-lock <evm_recipient> <amount_zion> [--chain base]
//!                                           — lock ZION to bridge vault
//!
//! Configuration (env vars):
//!   ZION_WALLET_SK_HEX  — Ed25519 secret key hex (64 hex chars)
//!   ZION_WALLET_KEY_FILE — path to file containing secret key hex
//!   ZION_RPC_ADDR       — node RPC address (default: 127.0.0.1:9443)
//!                         HTTPS/HTTP JSON-RPC URLs also supported, e.g.
//!                         https://rpc.zionterranova.com/jsonrpc

use std::env;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::process;
use std::time::Duration;

use ed25519_dalek::SigningKey;
use serde_json::{json, Value};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        usage();
    }

    match args[1].as_str() {
        "info" => cmd_info(),
        "balance" => cmd_balance(args.get(2).map(|s| s.as_str())),
        "utxos" => cmd_utxos(args.get(2).map(|s| s.as_str())),
        "send" => {
            if args.len() < 4 {
                eprintln!("Usage: wallet send <to_address> <amount_zion> [--fee <fee_flowers>] [--memo <memo>] [--yes]");
                process::exit(1);
            }
            let fee = parse_flag(&args, "--fee")
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1_000);
            let memo = parse_flag(&args, "--memo");
            let yes = args.iter().any(|a| a == "--yes");
            cmd_send(&args[2], &args[3], fee, memo, yes);
        }
        "bridge-lock" => {
            if args.len() < 4 {
                eprintln!(
                    "Usage: wallet bridge-lock <evm_recipient> <amount_zion> [--chain <chain>] [--yes]"
                );
                process::exit(1);
            }
            let chain = parse_flag(&args, "--chain").unwrap_or_else(|| "base".to_string());
            let yes = args.iter().any(|a| a == "--yes");
            cmd_bridge_lock(&args[2], &args[3], &chain, yes);
        }
        _ => usage(),
    }
}

fn usage() -> ! {
    eprintln!("ZION L1 Wallet CLI");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  info                                  Show wallet address");
    eprintln!("  balance [address]                     Query UTXO balance");
    eprintln!("  utxos   [address]                     List spendable UTXOs");
    eprintln!("  send <to> <amount_zion> [--fee N]     Send ZION");
    eprintln!("  bridge-lock <evm_addr> <amount_zion> [--chain C]  Lock to bridge vault");
    eprintln!();
    eprintln!("Environment:");
    eprintln!("  ZION_WALLET_SK_HEX   Secret key (hex)");
    eprintln!("  ZION_WALLET_KEY_FILE File containing secret key hex");
    eprintln!("  ZION_RPC_ADDR        Node RPC address (default: 127.0.0.1:9443)");
    eprintln!("                       HTTPS/HTTP JSON-RPC URLs are also supported.");
    eprintln!();
    eprintln!("Confirmation:");
    eprintln!("  send and bridge-lock ask for interactive confirmation by default.");
    eprintln!("  Add --yes to broadcast without prompting.");
    process::exit(1);
}

fn parse_flag(args: &[String], flag: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == flag).map(|w| w[1].clone())
}

// ── Key loading ────────────────────────────────────────────────────────

fn load_signing_key() -> SigningKey {
    let sk_hex = if let Ok(hex) = env::var("ZION_WALLET_SK_HEX") {
        hex.trim().to_string()
    } else if let Ok(path) = env::var("ZION_WALLET_KEY_FILE") {
        std::fs::read_to_string(&path)
            .unwrap_or_else(|e| die(&format!("cannot read key file {path}: {e}")))
            .trim()
            .to_string()
    } else {
        die("set ZION_WALLET_SK_HEX or ZION_WALLET_KEY_FILE");
    };

    let bytes =
        zion_core::crypto::from_hex(&sk_hex).unwrap_or_else(|| die("invalid hex in secret key"));
    if bytes.len() != 32 {
        die(&format!("secret key must be 32 bytes, got {}", bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    SigningKey::from_bytes(&arr)
}

fn own_address(sk: &SigningKey) -> String {
    zion_core::crypto::derive_address(sk.verifying_key().as_bytes())
}

// ── RPC ────────────────────────────────────────────────────────────────

fn rpc_addr() -> String {
    env::var("ZION_RPC_ADDR").unwrap_or_else(|_| "127.0.0.1:9443".into())
}

fn rpc_call(method: &str, params: Value) -> Value {
    let addr = rpc_addr();
    if addr.starts_with("http://") || addr.starts_with("https://") {
        rpc_call_http(&addr, method, params)
    } else {
        rpc_call_tcp(&addr, method, params)
    }
}

fn rpc_call_tcp(addr: &str, method: &str, params: Value) -> Value {
    let mut stream = TcpStream::connect(addr)
        .unwrap_or_else(|e| die(&format!("cannot connect to {addr}: {e}")));
    stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(10))).ok();

    let request = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    });
    let mut line = serde_json::to_string(&request).expect("json serialize");
    line.push('\n');
    stream
        .write_all(line.as_bytes())
        .unwrap_or_else(|e| die(&format!("write to {addr}: {e}")));
    stream.flush().ok();

    let mut reader = BufReader::new(stream);
    let mut resp_line = String::new();
    reader
        .read_line(&mut resp_line)
        .unwrap_or_else(|e| die(&format!("read from {addr}: {e}")));

    parse_response(&resp_line, addr)
}

fn rpc_call_http(url: &str, method: &str, params: Value) -> Value {
    let request = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    });
    let body = serde_json::to_string(&request).expect("json serialize");

    let output = std::process::Command::new("curl")
        .args([
            "-s", "-S",
            "-X", "POST",
            url,
            "-H", "Content-Type: application/json",
            "-d", &body,
            "-m", "30",
        ])
        .output()
        .unwrap_or_else(|e| die(&format!("cannot run curl: {e}")));

    if !output.status.success() {
        die(&format!(
            "curl failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    parse_response(
        &String::from_utf8_lossy(&output.stdout),
        url,
    )
}

fn parse_response(text: &str, source: &str) -> Value {
    let resp: Value = serde_json::from_str(text)
        .unwrap_or_else(|e| die(&format!("invalid JSON response from {source}: {e}")));

    if let Some(err) = resp.get("error") {
        die(&format!("RPC error: {err}"));
    }
    resp["result"].clone()
}

// ── Helpers ────────────────────────────────────────────────────────────

const FLOWERS_PER_ZION: u64 = zion_core::emission::FLOWERS_PER_ZION;

fn parse_zion_amount(s: &str) -> u64 {
    if let Some((whole, frac)) = s.split_once('.') {
        let whole_flowers: u64 = whole
            .parse::<u64>()
            .unwrap_or_else(|_| die("invalid amount"))
            * FLOWERS_PER_ZION;
        let padded = format!("{:0<6}", frac);
        if padded.len() > 6 {
            die("amount has too many decimal places (max 6)");
        }
        let frac_flowers: u64 = padded[..6]
            .parse()
            .unwrap_or_else(|_| die("invalid fractional amount"));
        whole_flowers + frac_flowers
    } else {
        s.parse::<u64>().unwrap_or_else(|_| die("invalid amount")) * FLOWERS_PER_ZION
    }
}

fn format_zion(flowers: u64) -> String {
    let whole = flowers / FLOWERS_PER_ZION;
    let frac = flowers % FLOWERS_PER_ZION;
    if frac == 0 {
        format!("{whole}")
    } else {
        let s = format!("{whole}.{frac:06}");
        s.trim_end_matches('0').to_string()
    }
}

fn die(msg: &str) -> ! {
    eprintln!("error: {msg}");
    process::exit(1);
}

fn hex_to_hash32(hex_str: &str) -> [u8; 32] {
    let bytes = zion_core::crypto::from_hex(hex_str)
        .unwrap_or_else(|| die(&format!("invalid hex hash: {hex_str}")));
    if bytes.len() != 32 {
        die(&format!("hash must be 32 bytes, got {}", bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    arr
}

fn ask_confirm(prompt: &str, yes_flag: bool) -> bool {
    if yes_flag {
        return true;
    }
    print!("{prompt} [y/N]: ");
    std::io::stdout().flush().ok();
    let mut line = String::new();
    if std::io::stdin().read_line(&mut line).is_err() {
        return false;
    }
    matches!(line.trim().to_lowercase().as_str(), "y" | "yes")
}

// ── Commands ───────────────────────────────────────────────────────────

fn cmd_info() {
    let sk = load_signing_key();
    let address = own_address(&sk);
    let pk_hex = zion_core::crypto::to_hex(sk.verifying_key().as_bytes());
    println!("address:    {address}");
    println!("public_key: {pk_hex}");
}

fn cmd_balance(address: Option<&str>) {
    let addr = match address {
        Some(a) => a.to_string(),
        None => {
            let sk = load_signing_key();
            own_address(&sk)
        }
    };
    let result = rpc_call("getUtxos", json!({ "address": addr }));
    let utxos = result["utxos"].as_array().cloned().unwrap_or_default();
    let total: u64 = utxos
        .iter()
        .map(|u| u["amount"].as_u64().unwrap_or(0))
        .sum();
    println!("address:     {addr}");
    println!("utxo count:  {}", utxos.len());
    println!("balance:     {} ZION", format_zion(total));
}

fn cmd_utxos(address: Option<&str>) {
    let addr = match address {
        Some(a) => a.to_string(),
        None => {
            let sk = load_signing_key();
            own_address(&sk)
        }
    };
    let result = rpc_call("getUtxos", json!({ "address": addr }));
    let utxos = result["utxos"].as_array().cloned().unwrap_or_default();
    let total: u64 = utxos
        .iter()
        .map(|u| u["amount"].as_u64().unwrap_or(0))
        .sum();
    println!("address: {addr}");
    println!("utxos:   {}", utxos.len());
    println!("total:   {} ZION", format_zion(total));
    for u in &utxos {
        println!(
            "  {}:{} — {} ZION (h={})",
            u["tx_hash"].as_str().unwrap_or("?"),
            u["output_index"].as_u64().unwrap_or(0),
            format_zion(u["amount"].as_u64().unwrap_or(0)),
            u["block_height"].as_u64().unwrap_or(0),
        );
    }
}

fn fetch_v31_utxos(address: &str) -> Vec<zion_core::v31_wallet::SpendableUtxo> {
    let result = rpc_call("getUtxos", json!({ "address": address }));
    let utxo_list = result["utxos"].as_array().cloned().unwrap_or_default();
    if utxo_list.is_empty() {
        die("no spendable UTXOs for this address");
    }

    utxo_list
        .iter()
        .map(|u| zion_core::v31_wallet::SpendableUtxo {
            tx_hash: hex_to_hash32(u["tx_hash"].as_str().unwrap_or("")),
            output_index: u["output_index"].as_u64().unwrap_or(0) as u32,
            amount: u["amount"].as_u64().unwrap_or(0),
            address: address.to_string(),
            block_height: u["block_height"].as_u64().unwrap_or(0),
            is_coinbase: u["is_coinbase"].as_bool().unwrap_or(false),
        })
        .collect()
}

fn cmd_send(to: &str, amount_str: &str, fee: u64, memo: Option<String>, yes: bool) {
    let sk = load_signing_key();
    let address = own_address(&sk);
    let amount_flowers = parse_zion_amount(amount_str);

    println!("from:   {address}");
    println!("to:     {to}");
    println!(
        "amount: {} ZION ({amount_flowers} flowers)",
        format_zion(amount_flowers)
    );
    println!("fee:    {fee} flowers");
    if let Some(ref m) = &memo {
        println!("memo:   {m}");
    }

    let available = fetch_v31_utxos(&address);

    let memo_bytes = memo.as_ref().map(|m| m.as_bytes()).unwrap_or(&[]);
    let build = if memo.is_some() {
        zion_core::v31_wallet::build_send_with_memo(
            &sk,
            &address,
            to,
            amount_flowers,
            fee,
            &available,
            memo_bytes,
        )
    } else {
        zion_core::v31_wallet::build_send(
            &sk,
            &address,
            to,
            amount_flowers,
            fee,
            &available,
        )
    }
    .unwrap_or_else(|e| die(&format!("build failed: {e}")));

    if !ask_confirm("Broadcast V31 UTXO transaction", yes) {
        println!("cancelled");
        process::exit(0);
    }

    let tx_json = serde_json::to_value(&build.transaction).expect("serialize tx");
    let submit = rpc_call("submitUtxoTransaction", json!({ "transaction": tx_json }));

    let tx_id = build.transaction.hash().to_hex();
    if submit["accepted"].as_bool() == Some(true) {
        println!("submitted: {tx_id}");
        if build.change_amount > 0 {
            println!("change:    {} ZION", format_zion(build.change_amount));
        }
    } else {
        die(&format!("rejected: {}", submit));
    }
}

fn cmd_bridge_lock(evm_recipient: &str, amount_str: &str, chain: &str, yes: bool) {
    let sk = load_signing_key();
    let address = own_address(&sk);
    let amount_flowers = parse_zion_amount(amount_str);
    let fee: u64 = 1_000; // MIN_TX_FEE
    let vault = zion_core::fee::BRIDGE_VAULT_ADDRESS;
    let memo = format!("BRIDGE:{chain}:{evm_recipient}");

    println!("from:      {address}");
    println!("vault:     {vault}");
    println!(
        "amount:    {} ZION ({amount_flowers} flowers)",
        format_zion(amount_flowers)
    );
    println!("chain:     {chain}");
    println!("recipient: {evm_recipient}");
    println!("memo:      {memo}");

    let available = fetch_v31_utxos(&address);

    let build = zion_core::v31_wallet::build_send_with_memo(
        &sk,
        &address,
        vault,
        amount_flowers,
        fee,
        &available,
        memo.as_bytes(),
    )
    .unwrap_or_else(|e| die(&format!("build failed: {e}")));

    if !ask_confirm("Broadcast bridge-lock V31 UTXO transaction", yes) {
        println!("cancelled");
        process::exit(0);
    }

    let tx_json = serde_json::to_value(&build.transaction).expect("serialize tx");
    let submit = rpc_call("submitUtxoTransaction", json!({ "transaction": tx_json }));

    let tx_id = build.transaction.hash().to_hex();
    if submit["accepted"].as_bool() == Some(true) {
        println!("submitted: {tx_id}");
        if build.change_amount > 0 {
            println!("change:    {} ZION", format_zion(build.change_amount));
        }
    } else {
        die(&format!("rejected: {}", submit));
    }
}
