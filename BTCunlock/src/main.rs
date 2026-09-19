//! BTCunlock — recovery toolkit for YOUR OWN lost BTC wallets.
//!
//! Modes:
//!   fix-mnemonic  — fill `?` placeholders in a BIP39 phrase (1-2 unknown
//!                   words), keep only checksum-valid candidates
//!   scan          — derive a mnemonic across standard paths
//!                   (BIP44/49/84, accounts, receive/change) and check
//!                   balances via esplora
//!   wif           — decode a WIF key, show derived addresses
//!
//! Legal use only: recovering wallets you own. Never run this against
//! phrases/keys that are not yours.

mod recover;
mod scan;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "btcunlock",
    version,
    about = "BTC wallet recovery toolkit (own wallets only)"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Complete a BIP39 phrase with unknown words marked `?` (max 2).
    FixMnemonic {
        /// The phrase, e.g. "word1 word2 ? word4 ..."
        phrase: String,
        /// Also derive the first BIP84 address for each valid candidate.
        #[arg(long)]
        derive: bool,
    },
    /// Scan a mnemonic over standard derivation paths; report funded
    /// addresses via an esplora-compatible API.
    Scan {
        /// Full valid mnemonic (quoted).
        mnemonic: String,
        /// mainnet | testnet
        #[arg(long, default_value = "mainnet")]
        network: String,
        /// Max index per path (receive + change chains).
        #[arg(long, default_value_t = 20)]
        max_index: u32,
        /// Account count to scan per script type.
        #[arg(long, default_value_t = 2)]
        accounts: u32,
        /// Esplora API base (default mempool.space per network).
        #[arg(long)]
        api: Option<String>,
        /// Skip network balance lookups (offline derivation only).
        #[arg(long)]
        offline: bool,
    },
    /// Decode a WIF private key: network, compression, P2PKH + P2WPKH addr.
    Wif { wif: String },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::FixMnemonic { phrase, derive } => recover::fix_mnemonic(&phrase, derive),
        Cmd::Scan {
            mnemonic,
            network,
            max_index,
            accounts,
            api,
            offline,
        } => scan::scan_mnemonic(&mnemonic, &network, max_index, accounts, api.as_deref(), offline),
        Cmd::Wif { wif } => scan::wif_info(&wif),
    }
}
