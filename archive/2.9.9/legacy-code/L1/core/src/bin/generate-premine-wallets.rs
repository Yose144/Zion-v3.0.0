/// ZION Genesis Premine Wallet Generator
///
/// Generates 12 BIP39 mnemonic wallets for all premine categories:
/// - 5× OASIS + Winners Golden Egg/Xp (8.25B total)
/// - 3× DAO Treasury (4.0B total)
/// - 3× Infrastructure (2.59B total)
/// - 1× Humanitarian Fund (1.44B total)
///
/// Each wallet: 24-word mnemonic → seed[:32] → Ed25519 → zion1... address
///
/// Output:
/// - BACKUP JSON file with all secrets + mnemonics
/// - Rust code snippet ready to paste into premine.rs
///
/// ⚠️  RUN THIS ONCE. SAVE THE BACKUP. DELETE THE BINARY.
/// ⚠️  THE BACKUP FILE CONTAINS PRIVATE KEYS — GUARD WITH YOUR LIFE.
use bip39::{Language, Mnemonic};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PremineWallet {
    index: usize,
    category: String,
    purpose: String,
    amount_zion: u64,
    amount_atomic: u64,
    mnemonic: String,
    secret_key_hex: String,
    public_key_hex: String,
    address: String,
    unlock_height: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug)]
struct PremineBackup {
    generated_at: String,
    generator: String,
    version: String,
    warning: String,
    total_wallets: usize,
    total_premine_zion: u64,
    wallets: Vec<PremineWallet>,
}

/// Wallet allocation definition
struct WalletDef {
    category: &'static str,
    purpose: &'static str,
    amount_zion: u64, // In full ZION
    unlock_height: Option<u64>,
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║   🌟 ZION Genesis Premine Wallet Generator v2.9.6         ║");
    println!("║                                                            ║");
    println!("║   ⚠️  THIS GENERATES REAL PRIVATE KEYS                    ║");
    println!("║   ⚠️  BACKUP THE OUTPUT FILE SECURELY                     ║");
    println!("║   ⚠️  DO NOT SHARE, DO NOT COMMIT TO GIT                  ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    // Define all 12 premine wallets
    let definitions: Vec<WalletDef> = vec![
        // === OASIS + Winners Golden Egg/Xp (5 slots × 1.65B = 8.25B) ===
        WalletDef {
            category: "oasis_golden_egg",
            purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
            amount_zion: 1_650_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "oasis_golden_egg",
            purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 2)",
            amount_zion: 1_650_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "oasis_golden_egg",
            purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 3)",
            amount_zion: 1_650_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "oasis_golden_egg",
            purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 4)",
            amount_zion: 1_650_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "oasis_golden_egg",
            purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 5)",
            amount_zion: 1_650_000_000,
            unlock_height: None,
        },
        // === DAO Treasury (3 slots = 4.0B) ===
        WalletDef {
            category: "dao_treasury",
            purpose: "DAO Treasury — Community Governance (main)",
            amount_zion: 2_500_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "dao_treasury",
            purpose: "DAO Treasury — Grants & Bounties",
            amount_zion: 1_000_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "dao_treasury",
            purpose: "DAO Treasury — Ecosystem Bootstrap",
            amount_zion: 500_000_000,
            unlock_height: None,
        },
        // === Infrastructure (3 slots = 2.59B) ===
        WalletDef {
            category: "infrastructure",
            purpose: "Core Development Fund",
            amount_zion: 1_000_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "infrastructure",
            purpose: "Network Infrastructure — P2P Seed Nodes",
            amount_zion: 1_000_000_000,
            unlock_height: None,
        },
        WalletDef {
            category: "infrastructure",
            purpose: "Genesis Creator — Lifetime Rent",
            amount_zion: 590_000_000,
            unlock_height: None,
        },
        // === Humanitarian (1 slot = 1.44B) ===
        WalletDef {
            category: "humanitarian",
            purpose: "Children Future Fund — Humanitarian DAO",
            amount_zion: 1_440_000_000,
            unlock_height: None,
        },
    ];

    let mut wallets: Vec<PremineWallet> = Vec::new();
    let mut total_zion: u64 = 0;

    for (i, def) in definitions.iter().enumerate() {
        // Generate 24-word BIP39 mnemonic
        let mnemonic = Mnemonic::generate_in_with(&mut OsRng, Language::English, 24)
            .expect("Failed to generate mnemonic");
        let phrase = mnemonic.to_string();

        // Derive Ed25519 key: seed[:32]
        let seed = mnemonic.to_seed("");
        let secret: [u8; 32] = seed[0..32].try_into().expect("seed slice");
        let signing_key = SigningKey::from_bytes(&secret);
        let verifying_key = signing_key.verifying_key();

        let secret_key_hex = bytes_to_hex(&secret);
        let public_key_hex = bytes_to_hex(verifying_key.as_bytes());
        let address =
            zion_core::crypto::keys::zion1_address_from_public_key_bytes(verifying_key.as_bytes());

        let amount_atomic = def.amount_zion * 1_000_000;
        total_zion += def.amount_zion;

        let wallet = PremineWallet {
            index: i + 1,
            category: def.category.to_string(),
            purpose: def.purpose.to_string(),
            amount_zion: def.amount_zion,
            amount_atomic,
            mnemonic: phrase,
            secret_key_hex,
            public_key_hex,
            address: address.clone(),
            unlock_height: def.unlock_height,
        };

        println!(
            "  [{:>2}/12] {} | {} | {:>13} ZION | {}",
            i + 1,
            def.category,
            &address,
            format_zion(def.amount_zion),
            def.purpose
        );

        wallets.push(wallet);
    }

    println!();
    println!(
        "Total: {} ZION across {} wallets",
        format_zion(total_zion),
        wallets.len()
    );
    assert_eq!(total_zion, 16_280_000_000, "Premine total mismatch!");
    println!("✅ Premine total verified: 16,280,000,000 ZION (16.28B)");

    // Create backup
    let backup = PremineBackup {
        generated_at: chrono::Utc::now().to_rfc3339(),
        generator: "zion-premine-wallet-generator v2.9.6".to_string(),
        version: "2.9.6".to_string(),
        warning: "⚠️ THIS FILE CONTAINS PRIVATE KEYS AND MNEMONICS. \
                  STORE OFFLINE. DO NOT COMMIT TO GIT. DO NOT SHARE. \
                  LOSS OF THIS FILE = LOSS OF ALL PREMINE FUNDS."
            .to_string(),
        total_wallets: wallets.len(),
        total_premine_zion: total_zion,
        wallets: wallets.clone(),
    };

    // Write backup JSON
    let backup_json = serde_json::to_string_pretty(&backup).expect("JSON serialize");
    let backup_path = "PREMINE_WALLETS_BACKUP.json";
    fs::write(backup_path, &backup_json).expect("write backup");
    println!();
    println!("💾 Backup written to: {}", backup_path);
    println!("⚠️  MOVE THIS FILE TO SECURE OFFLINE STORAGE IMMEDIATELY!");

    // Generate Rust code snippet for premine.rs
    println!();
    println!("════════════════════════════════════════════════════════════════");
    println!("  📋 PREMINE.RS CODE — Copy below into core/src/blockchain/premine.rs");
    println!("════════════════════════════════════════════════════════════════");
    println!();

    // OASIS + Golden Egg
    println!("pub const OASIS_GOLDEN_EGG_POOL: &[(&str, &str, u64)] = &[");
    for w in wallets.iter().filter(|w| w.category == "oasis_golden_egg") {
        println!("    (");
        println!("        \"{}\",", w.address);
        println!("        \"{}\",", w.purpose);
        println!(
            "        {:>19}, // {:.2}B ZION",
            w.amount_atomic,
            w.amount_zion as f64 / 1_000_000_000.0
        );
        println!("    ),");
    }
    println!("];");
    println!();

    // DAO Treasury
    println!("pub const DAO_TREASURY: &[(&str, &str, u64)] = &[");
    for w in wallets.iter().filter(|w| w.category == "dao_treasury") {
        println!("    (");
        println!("        \"{}\",", w.address);
        println!("        \"{}\",", w.purpose);
        println!(
            "        {:>19}, // {:.2}B ZION",
            w.amount_atomic,
            w.amount_zion as f64 / 1_000_000_000.0
        );
        println!("    ),");
    }
    println!("];");
    println!();

    // Infrastructure
    println!("pub const INFRASTRUCTURE: &[(&str, &str, u64)] = &[");
    for w in wallets.iter().filter(|w| w.category == "infrastructure") {
        println!("    (");
        println!("        \"{}\",", w.address);
        println!("        \"{}\",", w.purpose);
        println!(
            "        {:>19}, // {:.2}B ZION",
            w.amount_atomic,
            w.amount_zion as f64 / 1_000_000_000.0
        );
        println!("    ),");
    }
    println!("];");
    println!();

    // Humanitarian
    println!("pub const HUMANITARIAN: &[(&str, &str, u64)] = &[");
    for w in wallets.iter().filter(|w| w.category == "humanitarian") {
        println!("    (");
        println!("        \"{}\",", w.address);
        println!("        \"{}\",", w.purpose);
        println!(
            "        {:>19}, // {:.2}B ZION",
            w.amount_atomic,
            w.amount_zion as f64 / 1_000_000_000.0
        );
        println!("    ),");
    }
    println!("];");

    println!();
    println!("════════════════════════════════════════════════════════════════");
    println!("  ✅ DONE. Remember to:");
    println!("  1. Copy the Rust code above into premine.rs");
    println!("  2. Move PREMINE_WALLETS_BACKUP.json to offline storage");
    println!("  3. Delete this binary after use");
    println!("  4. Run `cargo test -p zion-core` to verify");
    println!("════════════════════════════════════════════════════════════════");
}

fn format_zion(amount: u64) -> String {
    if amount >= 1_000_000_000 {
        format!("{:.2}B", amount as f64 / 1_000_000_000.0)
    } else if amount >= 1_000_000 {
        format!("{:.2}M", amount as f64 / 1_000_000.0)
    } else {
        format!("{}", amount)
    }
}
