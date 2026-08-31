use anyhow::Result;
use clap::Subcommand;
use sha2::Digest;

use crate::rpc::agent_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum AtomicSwapCmd {
    /// Atomic swap service health
    Status,
    /// Get the escrow address for SWAP:LOCK memos
    Escrow,
    /// Query HTLC status by hash
    Get { hash: String },
    /// Create (initiate) a new HTLC lock on ZION L1
    Create {
        amount: f64,
        chain: String,
        recipient: String,
        #[arg(long)]
        preimage: Option<String>,
        #[arg(long, default_value_t = 120)]
        timeout: u64,
    },
    /// List pending HTLCs
    Pending,
    /// Claim ZION by revealing preimage
    Claim {
        hash: String,
        preimage: String,
        recipient: String,
        #[arg(long)]
        token: Option<String>,
    },
    /// Refund expired HTLC
    Refund {
        hash: String,
        #[arg(long)]
        token: Option<String>,
    },
}

pub async fn run(cmd: AtomicSwapCmd, swap_url: &str) -> Result<()> {
    let url = swap_url.trim_end_matches('/').to_string();

    match cmd {
        AtomicSwapCmd::Status => {
            ui::print_header("ZION Atomic Swap (L2)");
            match agent_rpc::health(&url).await {
                Ok(true) => ui::print_ok(&format!("Atomic swap service online at {}", url)),
                _ => {
                    ui::print_err(&format!("Atomic swap unreachable at {}", url));
                }
            }
            println!();
        }
        AtomicSwapCmd::Escrow => {
            ui::print_header("Atomic Swap Escrow Address");
            match agent_rpc::get(&url, "swap/escrow-address").await {
                Ok(v) => {
                    if let Some(addr) = v["escrow_address"].as_str() {
                        ui::print_row("Escrow", addr);
                        ui::print_info("Use this address in a ZION TX memo:");
                        println!("  SWAP:LOCK:<hash>:<timeout_min>:<chain>:<counterparty_addr>");
                    }
                }
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
        }
        AtomicSwapCmd::Get { hash } => {
            ui::print_header(&format!("HTLC {}", hash));
            match agent_rpc::get(&url, &format!("swap/{}", hash)).await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("HTLC not found: {}", e)),
            }
            println!();
        }
        AtomicSwapCmd::Create {
            amount,
            chain,
            recipient,
            preimage,
            timeout,
        } => {
            ui::print_header("Create Atomic Swap");

            let (preimage_hex, hash_hex) = match preimage {
                Some(p) => {
                    if p.len() != 64 {
                        ui::print_err("Preimage must be 64-char hex!");
                        return Ok(());
                    }
                    let hash_bytes = sha2::Sha256::digest(hex::decode(&p)?);
                    (p, hex::encode(hash_bytes))
                }
                None => {
                    use rand::Rng;
                    let mut bytes = [0u8; 32];
                    rand::thread_rng().fill(&mut bytes);
                    let preimage_hex = hex::encode(bytes);
                    let hash_bytes = sha2::Sha256::digest(bytes);
                    (preimage_hex, hex::encode(hash_bytes))
                }
            };

            ui::print_row("Preimage (SAVE!)", &preimage_hex);
            ui::print_row("Hashlock (SHA-256)", &hash_hex);
            ui::print_row("Amount", &format!("{} ZION", amount));
            ui::print_row("Target Chain", &chain);
            ui::print_row("Recipient", &recipient);
            ui::print_row("Timeout", &format!("{} minutes", timeout));

            match agent_rpc::get(&url, "swap/escrow-address").await {
                Ok(v) => {
                    if let Some(escrow_addr) = v["escrow_address"].as_str() {
                        ui::print_row("Escrow Address", escrow_addr);
                        let memo =
                            format!("SWAP:LOCK:{}:{}:{}:{}", hash_hex, timeout, chain, recipient);
                        println!();
                        ui::print_info(
                            "To lock funds, send ZION on L1 to the escrow address with this memo:",
                        );
                        println!("  Address: {}", escrow_addr);
                        println!("  Amount:  {} ZION", amount);
                        println!("  Memo:    {}", memo);
                    }
                }
                Err(e) => ui::print_warn(&format!("Failed to get escrow address: {}", e)),
            }
            println!();
        }
        AtomicSwapCmd::Pending => {
            ui::print_header("Pending HTLCs");
            match agent_rpc::get(&url, "swap/pending").await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
        }
        AtomicSwapCmd::Claim {
            hash,
            preimage,
            recipient,
            token,
        } => {
            ui::print_header("Claim HTLC");
            ui::print_row("Hash", &hash);
            ui::print_row("Recipient", &recipient);

            let bearer = token.or_else(|| std::env::var("ZION_ATOMIC_SWAP_TOKEN").ok());
            if bearer.is_none() {
                ui::print_warn("No bearer token. Use --token or ZION_ATOMIC_SWAP_TOKEN env var.");
                return Ok(());
            }

            let body = serde_json::json!({
                "hash_hex": hash,
                "preimage_hex": preimage,
                "recipient": recipient,
            });
            match agent_rpc::post(&url, "swap/claim", body).await {
                Ok(v) => {
                    if v["status"] == "ok" {
                        ui::print_ok("Claim submitted successfully");
                    } else {
                        ui::print_warn(&format!(
                            "Claim failed: {}",
                            v["message"].as_str().unwrap_or("unknown")
                        ));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_err(&format!("Claim failed: {}", e)),
            }
            println!();
        }
        AtomicSwapCmd::Refund { hash, token } => {
            ui::print_header("Refund HTLC");
            ui::print_row("Hash", &hash);

            let bearer = token.or_else(|| std::env::var("ZION_ATOMIC_SWAP_TOKEN").ok());
            if bearer.is_none() {
                ui::print_warn("No bearer token. Use --token or ZION_ATOMIC_SWAP_TOKEN env var.");
                return Ok(());
            }

            let body = serde_json::json!({ "hash_hex": hash });
            match agent_rpc::post(&url, "swap/refund", body).await {
                Ok(v) => {
                    if v["status"] == "ok" {
                        ui::print_ok("Refund submitted successfully");
                    } else {
                        ui::print_warn(&format!(
                            "Refund failed: {}",
                            v["message"].as_str().unwrap_or("unknown")
                        ));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_err(&format!("Refund failed: {}", e)),
            }
            println!();
        }
    }
    Ok(())
}
