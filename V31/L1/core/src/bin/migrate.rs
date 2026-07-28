//! V3 -> V31 chain state migration binary.
//!
//! Reads a V3 `zion-node-state.db` JSON export and seeds a V31 SQLite node
//! database with a migration block containing the final account/UTXO balances.
//!
//! Example:
//! ```text
//! zion-migrate --v3-state /data/zion/state --db-path zion-node.db
//! ```

use std::path::Path;

use clap::Parser;
use zion_core::migration::migrate_v3_state;
use zion_core::storage::Storage;

#[derive(Parser, Debug)]
#[command(
    name = "zion-migrate",
    about = "Migrate a V3 chain state snapshot to V31"
)]
struct Args {
    /// Path to the V3 `zion-node-state.db` JSON file.
    #[arg(long, short = 's')]
    v3_state: String,

    /// Path to the V31 node database (will be created if missing).
    #[arg(long, short = 'd', default_value = "zion-node.db")]
    db_path: String,

    /// Skip writing the migration block; only validate and print summary.
    #[arg(long, default_value_t = false)]
    dry_run: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    let storage = if args.dry_run || args.db_path == ":memory:" {
        if args.dry_run {
            println!("dry-run: writing to in-memory store only");
        }
        Storage::open_in_memory().await?
    } else {
        Storage::open(Path::new(&args.db_path)).await?
    };

    let summary = migrate_v3_state(&args.v3_state, &storage).await?;

    println!("Migration complete.");
    println!("  V3 height:          {}", summary.v3_height);
    println!("  V3 tip hash:        {}", summary.v3_tip_hash);
    println!("  Migration height:   {}", summary.migration_height);
    println!("  Output count:       {}", summary.output_count);
    println!("  Total flowers:      {}", summary.total_flowers);
    println!(
        "  Timestamp:          {} (difficulty: {})",
        summary.timestamp, summary.difficulty
    );

    Ok(())
}
