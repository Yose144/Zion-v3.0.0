//! WARP Beta — BTC-leg E2E (WARP Beta C8).
//!
//! These tests are `#[ignore]`d by default — they hit a real Bitcoin network
//! and spend real (test) coins. Two modes:
//!
//! **regtest** (verified 2026-09-17) — docker `blockstream/esplora`:
//! ```bash
//! docker run -d -p 50002:80 blockstream/esplora \
//!   bash -c "/srv/explorer/run.sh bitcoin-regtest explorer"
//! # generate keys: BITCOIN_NETWORK=regtest cargo test ... gen_keys
//! # fund: bitcoin-cli -regtest generatetoaddress 105 <addr>
//! BITCOIN_NETWORK=regtest \
//! WARP_BITCOIN_API=http://127.0.0.1:50002/regtest/api \
//! WARP_BTC_OPERATOR_WIF=.. WARP_BTC_USER_WIF=.. \
//! cargo test -p zion-multichain --test btc_swap_signet -- --ignored --nocapture
//! ```
//!
//! **signet** (public network) — funded signet keys:
//! ```bash
//! BITCOIN_NETWORK=signet \
//! WARP_BITCOIN_API=https://mempool.space/signet/api \
//! WARP_BTC_OPERATOR_WIF=<operator WIF, funded> \
//! WARP_BTC_USER_WIF=<user WIF, funded> \
//! cargo test -p zion-multichain --test btc_swap_signet -- --ignored --nocapture
//! ```
//!
//! `e2e_signet_claim_path` — user locks BTC to the per-swap P2WSH HTLC,
//! operator claims with the preimage; `detect_htlc_spend` must surface the
//! preimage (the value that would unlock the ZION leg).
//!
//! `e2e_signet_refund_path` — user locks BTC with a short CLTV, waits for
//! expiry, and refunds; proves the timeout branch end-to-end.

use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use bitcoin::{Network, OutPoint, Txid};
use sha2::Digest as _;
use zion_multichain::warp::adapter::bitcoin::{BitcoinAdapter, BtcHtlcSpend};
use zion_multichain::warp::adapter::ChainAdapter;
use zion_multichain::warp::btc_htlc::{BtcHtlc, HtlcUtxo};
use zion_multichain::warp::btc_signer::BtcSigner;

const POLL_SECS: u64 = 5;
const WAIT_TIMEOUT: Duration = Duration::from_secs(60 * 30); // signet blocks are irregular

fn env_or_skip() -> Option<(BtcSigner, BtcSigner, Arc<BitcoinAdapter>)> {
    let op_wif = std::env::var("WARP_BTC_OPERATOR_WIF").ok()?;
    let user_wif = std::env::var("WARP_BTC_USER_WIF").ok()?;
    let network: Network = std::env::var("BITCOIN_NETWORK")
        .unwrap_or_else(|_| "signet".into())
        .parse()
        .expect("BITCOIN_NETWORK");
    let op = BtcSigner::from_wif(&op_wif, network).expect("operator WIF");
    let user = BtcSigner::from_wif(&user_wif, network).expect("user WIF");
    let btc = Arc::new(BitcoinAdapter::new());
    eprintln!(
        "[e2e] network={network} operator {} / user {}",
        op.address(),
        user.address()
    );
    Some((op, user, btc))
}

/// Poll `f` until it returns `Some`, with a generous timeout for irregular
/// signet block times.
async fn wait_for<F, Fut, T>(what: &str, mut f: F) -> T
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Option<T>>,
{
    let start = Instant::now();
    loop {
        if let Some(v) = f().await {
            return v;
        }
        assert!(start.elapsed() < WAIT_TIMEOUT, "timed out waiting for {what}");
        eprintln!("[e2e] waiting for {what}…");
        tokio::time::sleep(Duration::from_secs(POLL_SECS)).await;
    }
}

/// One-off helper: request testnet4 faucet funds for an address.
#[tokio::test]
#[ignore]
async fn faucet_request() {
    let addr = std::env::var("FAUCET_ADDRESS").expect("FAUCET_ADDRESS");
    let client = reqwest::Client::new();
    let bal = client
        .get("https://api.testnet4.dev/faucetwalletbalance")
        .send()
        .await;
    eprintln!("balance: {:?}", bal.map(|r| r.status()));
    let resp = client
        .post("https://api.testnet4.dev/dispensefunds")
        .json(&serde_json::json!({
            "btcAddress": addr,
            "hCaptchaToken": "",
            "amount": 0.001,
        }))
        .send()
        .await;
    match resp {
        Ok(r) => eprintln!("dispense: {} {}", r.status(), r.text().await.unwrap_or_default()),
        Err(e) => eprintln!("dispense error: {e}"),
    }
}

/// Generate two fresh signet keypairs and print WIF + address.
/// Run once: `cargo test -p zion-multichain --test btc_swap_signet gen_keys -- --ignored --nocapture`
#[test]
#[ignore]
fn gen_keys() {
    use bitcoin::secp256k1::SecretKey;
    use bitcoin::PrivateKey;
    let network: Network = std::env::var("BITCOIN_NETWORK")
        .unwrap_or_else(|_| "signet".into())
        .parse()
        .expect("BITCOIN_NETWORK");
    for role in ["OPERATOR", "USER"] {
        let mut sk_bytes = [0u8; 32];
        rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut sk_bytes);
        let sk = SecretKey::from_slice(&sk_bytes).unwrap();
        let pk = PrivateKey::new(sk, network);
        let signer = BtcSigner::from_wif(&pk.to_wif(), network).unwrap();
        eprintln!("WARP_BTC_{role}_WIF={}", pk.to_wif());
        eprintln!("{role}_ADDRESS={}", signer.address());
        eprintln!();
    }
}

#[tokio::test]
#[ignore]
async fn e2e_signet_claim_path() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();

    let preimage: [u8; 32] = {
        let mut p = [0u8; 32];
        rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut p);
        p
    };
    let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();

    let tip = btc.current_height().await.unwrap();
    // Claimant = operator, refund = user, generous CLTV (we claim before it).
    let htlc = BtcHtlc::new(
        hashlock,
        *op.public_key_btc(),
        *user.public_key_btc(),
        (tip + 144) as u32,
        op.network(),
    )
    .unwrap();
    eprintln!("[e2e] HTLC address {}", htlc.address);

    // 1. User locks BTC into the HTLC.
    let (txid, vout, sats) = user
        .lock_htlc(&client, &api, &htlc, 5_000)
        .await
        .expect("lock_htlc broadcast");
    eprintln!("[e2e] locked {sats} sats in {txid}:{vout}");

    // 2. Detect the funding output (wait for ≥1 conf).
    let lock = wait_for("lock detection", {
        let btc = btc.clone();
        let htlc = htlc.clone();
        move || {
            let btc = btc.clone();
            let htlc = htlc.clone();
            async move {
                btc.detect_htlc_lock(&htlc, 5_000)
                    .await
                    .ok()
                    .flatten()
                    .filter(|l| l.confirmations >= 1)
            }
        }
    })
    .await;
    assert_eq!(lock.txid, txid);
    eprintln!("[e2e] lock detected, {} confs", lock.confirmations);

    // 3. Operator claims with the preimage.
    let utxo = HtlcUtxo {
        outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), lock.vout),
        value_sats: lock.value_sats,
    };
    let claim_tx = op
        .claim_htlc(&client, &api, &utxo, &htlc, preimage, op.address())
        .await
        .expect("claim_htlc broadcast");
    eprintln!("[e2e] claim broadcast {claim_tx}");

    // 4. detect_htlc_spend must classify Claim and surface the preimage.
    let spend = wait_for("spend detection", {
        let btc = btc.clone();
        let htlc = htlc.clone();
        move || {
            let btc = btc.clone();
            let htlc = htlc.clone();
            let lock = lock.clone();
            async move { btc.detect_htlc_spend(&htlc, &lock).await.ok().flatten() }
        }
    })
    .await;
    match spend {
        BtcHtlcSpend::Claim { txid, preimage: p } => {
            assert_eq!(p, preimage, "extracted preimage mismatch");
            assert_eq!(txid, claim_tx);
            eprintln!("[e2e] CLAIM verified — preimage {}", hex::encode(p));
        }
        other => panic!("expected Claim, got {other:?}"),
    }
}

#[tokio::test]
#[ignore]
async fn e2e_signet_refund_path() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();

    let preimage: [u8; 32] = {
        let mut p = [0u8; 32];
        rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut p);
        p
    };
    let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();

    let tip = btc.current_height().await.unwrap();
    // Short CLTV so the refund branch unlocks quickly (tip + 2 blocks).
    let htlc = BtcHtlc::new(
        hashlock,
        *op.public_key_btc(),
        *user.public_key_btc(),
        (tip + 2) as u32,
        op.network(),
    )
    .unwrap();
    eprintln!("[e2e] HTLC address {} (cltv {})", htlc.address, tip + 2);

    let (txid, vout, sats) = user
        .lock_htlc(&client, &api, &htlc, 5_000)
        .await
        .expect("lock_htlc broadcast");
    eprintln!("[e2e] locked {sats} sats in {txid}:{vout}");

    let lock = wait_for("lock detection", {
        let btc = btc.clone();
        let htlc = htlc.clone();
        move || {
            let btc = btc.clone();
            let htlc = htlc.clone();
            async move {
                btc.detect_htlc_lock(&htlc, 5_000)
                    .await
                    .ok()
                    .flatten()
                    .filter(|l| l.confirmations >= 1)
            }
        }
    })
    .await;
    eprintln!("[e2e] lock detected at height {}", lock.block_height);

    // Wait until the chain tip passes the CLTV height.
    let cltv = htlc.cltv_timeout as u64;
    wait_for("cltv expiry", {
        let btc = btc.clone();
        move || {
            let btc = btc.clone();
            async move { btc.current_height().await.ok().filter(|h| *h >= cltv) }
        }
    })
    .await;
    eprintln!("[e2e] CLTV expired, refunding");

    let utxo = HtlcUtxo {
        outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), lock.vout),
        value_sats: lock.value_sats,
    };
    let refund_tx = user
        .refund_htlc(&client, &api, &utxo, &htlc, user.address())
        .await
        .expect("refund_htlc broadcast");
    eprintln!("[e2e] refund broadcast {refund_tx}");

    let spend = wait_for("refund detection", {
        let btc = btc.clone();
        let htlc = htlc.clone();
        move || {
            let btc = btc.clone();
            let htlc = htlc.clone();
            let lock = lock.clone();
            async move { btc.detect_htlc_spend(&htlc, &lock).await.ok().flatten() }
        }
    })
    .await;
    match spend {
        BtcHtlcSpend::Refund { txid } => {
            assert_eq!(txid, refund_tx);
            eprintln!("[e2e] REFUND verified — {refund_tx}");
        }
        other => panic!("expected Refund, got {other:?}"),
    }
}
