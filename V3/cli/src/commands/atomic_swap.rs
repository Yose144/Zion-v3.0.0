use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::rpc::agent_rpc;
use crate::ui;

fn swap_url(cfg: &Config) -> String {
    format!("http://{}:{}", cfg.node.rpc_host, cfg.atomic_swap.port)
}

#[derive(Subcommand)]
pub enum AtomicSwapCmd {
    /// Atomic swap service health
    Status,
    /// Get the escrow address for SWAP:LOCK memos
    Escrow,
    /// Query HTLC status by hash
    Get { hash: String },
    /// List pending HTLCs (admin/auth required)
    Pending,
    /// Claim ZION by revealing preimage
    Claim {
        /// SHA-256 hash (64-char hex)
        hash: String,
        /// 32-byte preimage (64-char hex)
        preimage: String,
        /// L1 address to receive ZION
        recipient: String,
        /// Bearer token for auth (or set ZION_ATOMIC_SWAP_TOKEN env var)
        #[arg(long)]
        token: Option<String>,
    },
    /// Refund expired HTLC
    Refund {
        /// Hash of the expired HTLC
        hash: String,
        /// Bearer token for auth
        #[arg(long)]
        token: Option<String>,
    },
}

pub async fn run(cfg: &Config, cmd: AtomicSwapCmd) -> Result<()> {
    let url = swap_url(cfg);

    match cmd {
        AtomicSwapCmd::Status => {
            ui::print_header("ZION Atomic Swap (L2)");
            let resp = agent_rpc::get(&url, "health").await;
            match resp {
                Ok(_) => ui::print_ok(&format!("Atomic swap service online at {}", url)),
                Err(e) => {
                    ui::print_err(&format!("Atomic swap unreachable at {}", url));
                    ui::print_info(&format!("Error: {}", e));
                }
            }
            println!();
            Ok(())
        }
        AtomicSwapCmd::Escrow => {
            ui::print_header("Atomic Swap Escrow Address");
            let resp = agent_rpc::get(&url, "swap/escrow-address").await;
            match resp {
                Ok(v) => {
                    if let Some(addr) = v["escrow_address"].as_str() {
                        ui::print_row("Escrow", addr);
                        ui::print_info("Use this address in a ZION TX memo:");
                        println!("  SWAP:LOCK:<hash>:<timeout_min>:<chain>:<counterparty_addr>");
                    }
                    if let Some(fmt) = v["memo_format"].as_str() {
                        ui::print_row("Format", fmt);
                    }
                }
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
            Ok(())
        }
        AtomicSwapCmd::Get { hash } => {
            ui::print_header(&format!("HTLC {}", hash));
            let resp = agent_rpc::get(&url, &format!("swap/{}", hash)).await;
            match resp {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("HTLC not found: {}", e)),
            }
            println!();
            Ok(())
        }
        AtomicSwapCmd::Pending => {
            ui::print_header("Pending HTLCs");
            let resp = agent_rpc::get(&url, "swap/pending").await;
            match resp {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
            Ok(())
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
                ui::print_warn("No bearer token provided. Use --token or ZION_ATOMIC_SWAP_TOKEN env var.");
                return Ok(());
            }

            let body = serde_json::json!({
                "hash_hex": hash,
                "preimage_hex": preimage,
                "recipient": recipient,
            });
            let resp = agent_rpc::post(&url, "swap/claim", body).await;
            match resp {
                Ok(v) => {
                    if v["status"] == "ok" {
                        ui::print_ok("Claim submitted successfully");
                    } else {
                        ui::print_warn(&format!("Claim failed: {}", v["message"].as_str().unwrap_or("unknown")));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_err(&format!("Claim failed: {}", e)),
            }
            println!();
            Ok(())
        }
        AtomicSwapCmd::Refund { hash, token } => {
            ui::print_header("Refund HTLC");
            ui::print_row("Hash", &hash);

            let bearer = token.or_else(|| std::env::var("ZION_ATOMIC_SWAP_TOKEN").ok());
            if bearer.is_none() {
                ui::print_warn("No bearer token provided. Use --token or ZION_ATOMIC_SWAP_TOKEN env var.");
                return Ok(());
            }

            let body = serde_json::json!({ "hash_hex": hash });
            let resp = agent_rpc::post(&url, "swap/refund", body).await;
            match resp {
                Ok(v) => {
                    if v["status"] == "ok" {
                        ui::print_ok("Refund submitted successfully");
                    } else {
                        ui::print_warn(&format!("Refund failed: {}", v["message"].as_str().unwrap_or("unknown")));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_err(&format!("Refund failed: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}
