use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::{Path, PathBuf};

use zion_core::storage::Storage;
use zion_l1_types::Hash;

#[derive(Parser)]
#[command(
    name = "core-util",
    about = "ZION core offline chain state utility",
    version
)]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Export chain metadata and all blocks as JSON
    ExportState {
        db_path: PathBuf,
        #[arg(long, help = "Output JSON file (default: stdout)")]
        out: Option<PathBuf>,
    },
    VerifyDb {
        db_path: PathBuf,
    },
    /// Dump blocks to JSON
    DumpBlocks {
        db_path: PathBuf,
        #[arg(long, help = "Maximum blocks to export")]
        limit: Option<u64>,
        #[arg(long, help = "Output JSON file (default: stdout)")]
        out: Option<PathBuf>,
    },
    /// Print current tip height
    TipHeight {
        db_path: PathBuf,
    },
    /// Get a single block by height or hash
    GetBlock {
        db_path: PathBuf,
        id: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Commands::ExportState { db_path, out } => cmd_export_state(db_path, out).await,
        Commands::VerifyDb { db_path } => cmd_verify_db(db_path).await,
        Commands::DumpBlocks {
            db_path,
            limit,
            out,
        } => cmd_dump_blocks(db_path, limit, out).await,
        Commands::TipHeight { db_path } => cmd_tip_height(db_path).await,
        Commands::GetBlock { db_path, id } => cmd_get_block(db_path, id).await,
    }
}

async fn open_db(path: &Path) -> Result<Storage> {
    Storage::open(path)
        .await
        .with_context(|| format!("Failed to open SQLite DB at {}", path.display()))
}

async fn cmd_export_state(db_path: PathBuf, out: Option<PathBuf>) -> Result<()> {
    let db = open_db(&db_path).await?;
    let tip_height = db.height().await?;
    let tip = db.tip().await?;
    let blocks = db.get_blocks_range(0, tip_height).await?;

    let export = serde_json::json!({
        "meta": meta_json(tip.as_ref().map(|(h, _)| h)),
        "tip_height": tip_height,
        "blocks_count": blocks.len(),
        "blocks": blocks.iter().map(block_json).collect::<Vec<_>>(),
    });

    let json_str = serde_json::to_string_pretty(&export)?;
    write_output(&json_str, out)?;
    Ok(())
}

async fn cmd_verify_db(db_path: PathBuf) -> Result<()> {
    let db = open_db(&db_path).await?;
    let mut ok = true;

    print!("Checking tip... ");
    match db.tip().await {
        Ok(Some((header, hash))) => {
            println!(
                "OK (height={}, difficulty={}, tip_hash={})",
                header.height,
                header.difficulty,
                hex::encode(hash.0)
            );
        }
        Ok(None) => {
            println!("EMPTY — no chain state found");
            ok = false;
        }
        Err(e) => {
            println!("FAIL: {}", e);
            ok = false;
        }
    }

    print!("Checking tip height... ");
    match db.height().await {
        Ok(h) => println!("OK (height={})", h),
        Err(e) => {
            println!("FAIL: {}", e);
            ok = false;
        }
    }

    print!("Checking block at height 0 (genesis)... ");
    match db.get_by_height(0).await {
        Ok(Some(_)) => println!("OK"),
        Ok(None) => {
            println!("MISSING — genesis block not found");
            ok = false;
        }
        Err(e) => {
            println!("FAIL: {}", e);
            ok = false;
        }
    }

    if ok {
        println!("\nVerification PASSED.");
    } else {
        println!("\nVerification FAILED.");
        std::process::exit(1);
    }
    Ok(())
}

async fn cmd_dump_blocks(db_path: PathBuf, limit: Option<u64>, out: Option<PathBuf>) -> Result<()> {
    let db = open_db(&db_path).await?;
    let tip = db.height().await?;
    let end = limit.map(|l| l.min(tip)).unwrap_or(tip);
    let blocks = db.get_blocks_range(0, end).await?;

    let export: Vec<_> = blocks.iter().map(block_json).collect();
    let json_str = serde_json::to_string_pretty(&export)?;
    write_output(&json_str, out)?;
    Ok(())
}

async fn cmd_tip_height(db_path: PathBuf) -> Result<()> {
    let db = open_db(&db_path).await?;
    let h = db.height().await?;
    println!("{}", h);
    Ok(())
}

async fn cmd_get_block(db_path: PathBuf, id: String) -> Result<()> {
    let db = open_db(&db_path).await?;
    let block = if id.chars().all(|c| c.is_ascii_digit()) {
        let height: u64 = id.parse().context("Invalid height")?;
        db.get_by_height(height).await?
    } else {
        let hash = hex::decode(&id).context("Invalid hex hash")?;
        if hash.len() != 32 {
            anyhow::bail!("Hash must be 32 bytes (64 hex chars)");
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&hash);
        db.get_by_hash(&Hash::new(arr)).await?
    };

    match block {
        Some(b) => {
            println!("{}", serde_json::to_string_pretty(&block_json(&b))?);
        }
        None => {
            println!("Block not found: {}", id);
            std::process::exit(1);
        }
    }
    Ok(())
}

// ── JSON helpers ───────────────────────────────────────────────────────

fn meta_json(header: Option<&zion_core::block::BlockHeader>) -> serde_json::Value {
    match header {
        Some(h) => serde_json::json!({
            "tip_height": h.height,
            "tip_difficulty": h.difficulty,
            "tip_timestamp": h.timestamp,
        }),
        None => serde_json::json!({ "tip_height": 0 }),
    }
}

fn block_json(block: &zion_core::block::Block) -> serde_json::Value {
    let header = &block.header;
    let hash = header.header_hash();
    serde_json::json!({
        "hash": hex::encode(hash.0),
        "prev_hash": hex::encode(header.previous_hash.0),
        "merkle_root": hex::encode(header.merkle_root.0),
        "height": header.height,
        "timestamp": header.timestamp,
        "difficulty": header.difficulty,
        "nonce": header.nonce,
        "transactions_count": block.transactions.len(),
    })
}

fn write_output(text: &str, out: Option<PathBuf>) -> Result<()> {
    match out {
        Some(path) => {
            std::fs::write(&path, text)
                .with_context(|| format!("Failed to write {}", path.display()))?;
            eprintln!("Wrote {}", path.display());
        }
        None => println!("{}", text),
    }
    Ok(())
}
