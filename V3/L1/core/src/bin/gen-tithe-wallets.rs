//! One-shot wallet generator for V3 mainnet tithe accounts.
//!
//! Generates Ed25519 keypairs and derives zion1... addresses for:
//! - Issobella Fund (L5/L6)
//! - Pool Fee
//!
//! Outputs JSON with secret keys — KEEP SECURE.

fn main() {
    let wallets = [
        ("issobella_fund", "L5/L6 ZION Issobella Fund"),
        ("pool_fee", "Pool Operator Fee"),
    ];

    println!("[");
    for (i, (name, description)) in wallets.iter().enumerate() {
        let (signing_key, verifying_key) = zion_core::crypto::generate_keypair();
        let address = zion_core::crypto::derive_address(verifying_key.as_bytes());
        let secret_hex = zion_core::crypto::to_hex(signing_key.as_bytes());
        let public_hex = zion_core::crypto::to_hex(verifying_key.as_bytes());

        // Validate the generated address
        assert!(
            zion_core::crypto::is_valid_address(&address),
            "Generated address failed validation: {address}"
        );

        let comma = if i < wallets.len() - 1 { "," } else { "" };
        println!(
            r#"  {{
    "name": "{name}",
    "description": "{description}",
    "address": "{address}",
    "public_key_hex": "{public_hex}",
    "secret_key_hex": "{secret_hex}",
    "created_utc": "{}"
  }}{comma}"#,
            chrono_stub()
        );
    }
    println!("]");

    eprintln!("⚠️  SAVE THIS OUTPUT SECURELY — secret keys are shown only once!");
}

fn chrono_stub() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    format!("2026-03-27T{:02}:{:02}:{:02}Z", (secs / 3600) % 24, (secs / 60) % 60, secs % 60)
}
