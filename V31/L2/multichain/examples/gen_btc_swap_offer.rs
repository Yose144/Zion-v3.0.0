//! One-shot: build a BTC→ZION test offer offline and print the
//! `btc_swap_records` snapshot JSON + HTLC address + preimage.
//! Used to inject a swap directly into warp.db for testnet rehearsal
//! (bypasses the ZIS-gated HTTP offer endpoint — operator-side testing).
//!
//! Env:
//!   WARP_BTC_RELAY_KEY   operator BTC WIF (testnet)
//!   USER_ZION_PUBKEY     hex, 32B Ed25519 pubkey of the ZION claimant
//!   USER_ZION_ADDRESS    zion1... claim address
//!   USER_BTC_PUBKEY      hex, 33B compressed secp256k1 (BTC refund key)
//!   BTC_TIP              current testnet tip height
//!   BTC_SATS             e.g. 10000
//!   ZION_FLOWERS         e.g. 10000000 (= 10 ZION)
//!   ZION_TIMEOUT_TS      unix seconds in the future (e.g. now+86400)

use rand::RngCore;
use std::str::FromStr;
use zion_multichain::warp::btc_swap::{
    BtcSwapConfig, BtcSwapFlow, OfferBtcToZion,
};
use zion_multichain::warp::btc_signer::BtcSigner;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let wif = std::env::var("WARP_BTC_RELAY_KEY")?;
    let signer = BtcSigner::from_wif(&wif, bitcoin::Network::Testnet)?;

    let mut cfg = BtcSwapConfig::default();
    cfg.btc_network = bitcoin::Network::Testnet;
    cfg.min_btc_confs = 1; // testnet rehearsal — faster than prod default 2

    let user_zion_pubkey: [u8; 32] = hex::decode(std::env::var("USER_ZION_PUBKEY")?)?
        .try_into()
        .map_err(|_| "USER_ZION_PUBKEY must be 32-byte hex")?;
    // Self-test default: operator pubkey doubles as the user refund key.
    let user_btc_pubkey = match std::env::var("USER_BTC_PUBKEY") {
        Ok(p) => bitcoin::PublicKey::from_str(&p)?,
        Err(_) => *signer.public_key_btc(),
    };

    let mut preimage = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut preimage);
    use sha2::Digest;
    let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();

    let flow = BtcSwapFlow::new(
        std::sync::Arc::new(zion_multichain::warp::adapter::bitcoin::BitcoinAdapter::new()),
        std::sync::Arc::new(signer),
        std::sync::Arc::new(zion_multichain::swap::htlc::HtlcSwap::new_offline()),
        cfg,
    );

    let now = chrono::Utc::now().timestamp() as u64;
    let tip: u64 = std::env::var("BTC_TIP")?.parse()?;
    let rec = flow.offer_btc_to_zion(
        OfferBtcToZion {
            hashlock,
            btc_sats: std::env::var("BTC_SATS")?.parse()?,
            zion_flowers: std::env::var("ZION_FLOWERS")?.parse()?,
            user_btc_refund: user_btc_pubkey,
            user_zion_claim: user_zion_pubkey,
            user_zion_address: std::env::var("USER_ZION_ADDRESS")?,
            zion_timeout_ts: std::env::var("ZION_TIMEOUT_TS")?.parse()?,
        },
        now,
        tip,
    )?;

    let snap = rec.to_snapshot();
    let out = serde_json::json!({
        "swap_id": rec.swap_id,
        "htlc_address": rec.btc_htlc.address.to_string(),
        "cltv_timeout": rec.btc_htlc.cltv_timeout,
        "preimage_hex": hex::encode(preimage),
        "hashlock_hex": hex::encode(hashlock),
        "snapshot": snap,
    });
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}
