//! Standalone helper: generate an Ethash/ProgPow DAG for a given epoch and
//! write it to disk in the cache format the miner expects:
//!
//!   [8 bytes: dag_size_entries as LE u64][DAG data as LE bytes]
//!
//! Usage:
//!   cargo run --release -p zion-auxpow --example gen_dag --features native-hashers -- <epoch> <out.bin>
//!
//! The DAG can then be uploaded to a rig and placed in the miner's cache
//! directory (default ~/.zion/dag-cache/progpow_epoch<epoch>.bin) to skip
//! slow on-device generation.
//!
//! NOTE: This helper requires the OpenMP runtime, so it is intended to run on
//! Linux (the same environment used for SMOS builds). On other platforms it
//! compiles to a stub that prints this message.

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!(
        "gen_dag helper is only supported on Linux (OpenMP runtime required). \
         Run it on the build server with: cargo run --release -p zion-auxpow --example gen_dag --features native-hashers -- <epoch> <out.bin>"
    );
    std::process::exit(1);
}

#[cfg(target_os = "linux")]
fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let epoch: u32 = args
        .get(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(120);
    let out_path = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| format!("ethash_epoch{}.bin", epoch));

    eprintln!("Generating Ethash/ProgPow DAG for epoch {}...", epoch);
    let started = std::time::Instant::now();
    let dag = zion_auxpow::generate_ethash_dag(epoch)
        .ok_or_else(|| anyhow::anyhow!("ethash_generate_dag returned NULL"))?;
    let entries = dag.dag_size_entries;
    let bytes = (entries as usize)
        .checked_mul(128)
        .ok_or_else(|| anyhow::anyhow!("DAG size overflow"))?;
    eprintln!(
        "DAG ready: {} entries = {} bytes ({:.1} MB) in {:?}",
        entries,
        bytes,
        bytes as f64 / (1024.0 * 1024.0),
        started.elapsed()
    );

    let mut data = Vec::with_capacity(8 + bytes);
    data.extend_from_slice(&entries.to_le_bytes());
    for word in dag.as_u64_slice().iter() {
        data.extend_from_slice(&word.to_le_bytes());
    }
    fs::write(&out_path, data)?;
    eprintln!("Wrote {}", out_path);
    Ok(())
}
