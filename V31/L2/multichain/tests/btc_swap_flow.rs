//! WARP Beta — cross-leg swap flow E2E (WARP Beta C8 extension).
//!
//! Drives the real `BtcSwapFlow` orchestrator end-to-end: the BTC leg runs on
//! a live Bitcoin network (regtest or signet, real consensus + broadcast),
//! while the ZION leg runs through the production `HtlcSwap` coordinator path
//! (`initiate`/`claim`/`claim_source`) in offline-adapter mode — the same
//! state transitions and guards as production, without spending real ZION.
//!
//! `#[ignore]`d by default. Required env:
//!
//! ```bash
//! BITCOIN_NETWORK=regtest \
//! WARP_BITCOIN_API=http://127.0.0.1:50002/regtest/api \
//! WARP_BTC_OPERATOR_WIF=<operator WIF, funded> \
//! WARP_BTC_USER_WIF=<user WIF, funded> \
//! # optional but recommended on regtest — command run by the test to mine:
//! WARP_BTC_MINE_CMD='ssh zion-new docker exec esplora-regtest bitcoin-cli -regtest generatetoaddress {n} <miner addr>' \
//! cargo test -p zion-multichain --test btc_swap_flow -- --ignored --nocapture
//! ```
//!
//! `e2e_flow_btc_to_zion` — user locks BTC → orchestrator locks ZION
//! (coordinator `initiate`) → user claims ZION (coordinator `claim`, reveals
//! preimage) → orchestrator claims the user's BTC on-chain.
//!
//! `e2e_flow_zion_to_btc` — user locks ZION (txid supplied) → orchestrator
//! locks BTC on-chain → user claims BTC (real witness, reveals preimage) →
//! orchestrator claims the user's ZION lock via `claim_source`.

use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use bitcoin::{Network, OutPoint, Txid};
use sha2::Digest as _;
use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};
use zion_multichain::swap::htlc::{HtlcSwap, SwapState};
use zion_multichain::types::{Transfer, TransferDirection, TransferEndpoint};
use zion_multichain::warp::adapter::bitcoin::{BitcoinAdapter, BtcHtlcSpend};
use zion_multichain::warp::adapter::ChainAdapter;
use zion_multichain::warp::btc_htlc::HtlcUtxo;
use zion_multichain::warp::btc_signer::BtcSigner;
use zion_multichain::warp::btc_swap::{
    BtcSwapConfig, BtcSwapFlow, BtcSwapPhase, OfferBtcToZion, OfferZionToBtc,
};
use zion_multichain::chain::adapters::ZionL1Adapter;
use zion_multichain::chain::ChainAdapter as L1ChainAdapter;
use zion_multichain::wallet::Keyring;
use zion_multichain::{db::Db, ChainAdapterRegistry};

const POLL_SECS: u64 = 5;
const WAIT_TIMEOUT: Duration = Duration::from_secs(60 * 30);
const SWAP_SATS: u64 = 10_000;
const MIN_CONFS: u64 = 1;
const MARGIN_BLOCKS: u32 = 6;

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

/// Mine `n` blocks on regtest via `WARP_BTC_MINE_CMD` (`{n}` expands to the
/// count). On signet this is a no-op — blocks arrive naturally and `wait_for`
/// has a generous timeout.
async fn mine_blocks(n: u64) {
    let Ok(cmd) = std::env::var("WARP_BTC_MINE_CMD") else {
        return;
    };
    let cmd = cmd.replace("{n}", &n.to_string());
    let out = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .output()
        .await
        .expect("WARP_BTC_MINE_CMD spawn");
    assert!(
        out.status.success(),
        "WARP_BTC_MINE_CMD failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

/// Poll `f` until `Some`, generous timeout for irregular signet blocks.
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

/// Drive `flow.poll_once()` until the swap reaches a phase satisfying `pred`.
async fn poll_until(
    flow: &BtcSwapFlow,
    swap_id: &str,
    what: &str,
    pred: impl Fn(&BtcSwapPhase) -> bool,
) {
    let start = Instant::now();
    loop {
        let outcomes = flow.poll_once().await;
        for o in &outcomes {
            if o.swap_id == swap_id {
                eprintln!("[e2e] poll {} → {:?} ({:?})", o.swap_id, o.action, o.detail);
            }
        }
        if let Some(rec) = flow.record(swap_id).await {
            if pred(&rec.phase) {
                return;
            }
        }
        assert!(
            start.elapsed() < WAIT_TIMEOUT,
            "timed out waiting for {what}"
        );
        tokio::time::sleep(Duration::from_secs(POLL_SECS)).await;
    }
}

fn zion_endpoint(address: &str, amount: u64) -> TransferEndpoint {
    TransferEndpoint {
        address: Address::new(ChainId::ZionL1, address.as_bytes().to_vec(), address.to_string())
            .expect("zion endpoint"),
        asset: Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
        amount: Amount::new(amount as u128),
    }
}

fn fresh_preimage() -> ([u8; 32], [u8; 32]) {
    let mut preimage = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut preimage);
    let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();
    (preimage, hashlock)
}

/// User locks BTC → operator locks ZION → user claims ZION (preimage out)
/// → operator claims BTC. Proves preimage propagation BTC←ZION and the
/// operator's on-chain BTC claim.
#[tokio::test]
#[ignore]
async fn e2e_flow_btc_to_zion() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();

    // ZION identities (coordinator is offline — bookkeeping only).
    let (_, op_vk) = zion_core::crypto::generate_keypair();
    let (_, user_vk) = zion_core::crypto::generate_keypair();
    let op_zion_pk: [u8; 32] = *op_vk.as_bytes();
    let user_zion_pk: [u8; 32] = *user_vk.as_bytes();
    let op_zion_addr = zion_core::crypto::derive_address(&op_zion_pk);
    let user_zion_addr = zion_core::crypto::derive_address(&user_zion_pk);

    let (preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let zion_timeout = now + 7 * 24 * 3600;

    let swaps = Arc::new(HtlcSwap::new_offline());
    let cfg = BtcSwapConfig {
        btc_network: op.network(),
        min_btc_confs: MIN_CONFS,
        margin_blocks: MARGIN_BLOCKS,
        operator_zion_pubkey: op_zion_pk,
        operator_zion_address: op_zion_addr.clone(),
        operator_btc_dest: None,
        ..BtcSwapConfig::default()
    };
    let flow = BtcSwapFlow::new(btc.clone(), Arc::new(op), swaps.clone(), cfg);

    // 1. Offer — user gets a per-swap P2WSH HTLC address.
    let rec = flow
        .offer_btc_to_zion_live(OfferBtcToZion {
            hashlock,
            btc_sats: SWAP_SATS,
            zion_flowers: 50_000_000,
            user_btc_refund: *user.public_key_btc(),
            user_zion_claim: user_zion_pk,
            user_zion_address: user_zion_addr.clone(),
            zion_timeout_ts: zion_timeout,
        })
        .await
        .expect("offer_btc_to_zion");
    let swap_id = rec.swap_id.clone();
    eprintln!("[e2e] offer {swap_id} HTLC {}", rec.btc_htlc.address);

    // 2. User locks BTC; orchestrator must detect it (≥1 conf) and lock ZION.
    let (txid, vout, sats) = user
        .lock_htlc(&client, &api, &rec.btc_htlc, SWAP_SATS)
        .await
        .expect("user lock_htlc");
    eprintln!("[e2e] user locked {sats} sats in {txid}:{vout}");
    mine_blocks(1).await;

    poll_until(&flow, &swap_id, "phase=Locked (LockZion)", |p| {
        *p == BtcSwapPhase::Locked
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    assert!(rec.btc_lock.is_some(), "btc lock not recorded");
    assert!(rec.zion_lock_tx.is_some(), "zion lock not recorded");
    let coord = swaps.get_record(&swap_id).await.expect("coordinator record");
    assert_eq!(coord.state, SwapState::Pending);
    assert!(coord.source_confirmed, "user BTC lock not confirmed in coord");
    eprintln!("[e2e] orchestrator locked ZION leg (coord record)");

    // 3. User claims ZION through the production coordinator path — this is
    //    what `/v1/multichain/swaps/htlc/claim` does.
    let mut t = Transfer::new(
        format!("htlc-claim-{swap_id}"),
        TransferDirection::Htlc,
        zion_endpoint(&op_zion_addr, rec.zion_flowers),
        zion_endpoint(&user_zion_addr, rec.zion_flowers),
    );
    t.hashlock = Some(Hash::new(hashlock));
    swaps
        .claim(&preimage, &user_zion_addr, &mut t)
        .await
        .expect("user zion claim");
    assert_eq!(swaps.revealed_preimage(&swap_id).await, Some(preimage));
    eprintln!("[e2e] user claimed ZION — preimage revealed");

    // 4. Orchestrator sees the preimage and claims the user's BTC lock.
    poll_until(&flow, &swap_id, "phase=Settled (ClaimBtc)", |p| {
        *p == BtcSwapPhase::Settled
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    let settle_tx = rec.btc_settle_tx.clone().expect("no btc settle tx");
    eprintln!("[e2e] operator claimed BTC lock → {settle_tx}");

    // 5. Verify on-chain: the settle tx is a claim spend of the lock outpoint.
    mine_blocks(1).await;
    let lock = rec.btc_lock.unwrap();
    let spend = wait_for("settle spend detection", {
        let btc = btc.clone();
        let htlc = rec.btc_htlc.clone();
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
            assert_eq!(txid, settle_tx);
            assert_eq!(p, preimage, "witness preimage mismatch");
            eprintln!("[e2e] BTC→ZION swap SETTLED — claim {txid}, preimage {}", hex::encode(p));
        }
        other => panic!("expected Claim spend, got {other:?}"),
    }
}

/// User locks ZION (txid) → operator locks BTC → user claims BTC (preimage
/// out on-chain) → operator claims ZION. Proves preimage extraction from the
/// user's real BTC claim witness and the coordinator `claim_source` path.
#[tokio::test]
#[ignore]
async fn e2e_flow_zion_to_btc() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();

    let (_, op_vk) = zion_core::crypto::generate_keypair();
    let (_, user_vk) = zion_core::crypto::generate_keypair();
    let op_zion_pk: [u8; 32] = *op_vk.as_bytes();
    let user_zion_pk: [u8; 32] = *user_vk.as_bytes();
    let op_zion_addr = zion_core::crypto::derive_address(&op_zion_pk);
    let user_zion_addr = zion_core::crypto::derive_address(&user_zion_pk);

    let (preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let zion_timeout = now + 7 * 24 * 3600;

    let swaps = Arc::new(HtlcSwap::new_offline());
    let cfg = BtcSwapConfig {
        btc_network: op.network(),
        min_btc_confs: MIN_CONFS,
        margin_blocks: MARGIN_BLOCKS,
        operator_zion_pubkey: op_zion_pk,
        operator_zion_address: op_zion_addr.clone(),
        operator_btc_dest: None,
        ..BtcSwapConfig::default()
    };
    let flow = BtcSwapFlow::new(btc.clone(), Arc::new(op), swaps.clone(), cfg);

    // 1. Offer — the user's ZION lock already exists (txid supplied by the
    //    client; the coordinator trusts it in offline mode).
    let rec = flow
        .offer_zion_to_btc_live(OfferZionToBtc {
            hashlock,
            zion_flowers: 50_000_000,
            btc_sats: SWAP_SATS,
            user_btc_claim: *user.public_key_btc(),
            user_zion_refund: user_zion_pk,
            user_zion_lock_txid: "test-zion-lock-txid".into(),
            user_zion_address: user_zion_addr.clone(),
            zion_timeout_ts: zion_timeout,
        })
        .await
        .expect("offer_zion_to_btc");
    let swap_id = rec.swap_id.clone();
    eprintln!("[e2e] offer {swap_id} HTLC {}", rec.btc_htlc.address);

    // 2. Orchestrator locks BTC on-chain.
    poll_until(&flow, &swap_id, "phase=Locked (LockBtc)", |p| {
        *p == BtcSwapPhase::Locked
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    let lock = rec.btc_lock.clone().expect("no btc lock recorded");
    eprintln!("[e2e] operator locked {} sats in {}:{}", lock.value_sats, lock.txid, lock.vout);
    mine_blocks(1).await;

    // 3. User claims the operator's BTC lock — reveals the preimage on-chain.
    let utxo = HtlcUtxo {
        outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), lock.vout),
        value_sats: lock.value_sats,
    };
    let claim_tx = user
        .claim_htlc(&client, &api, &utxo, &rec.btc_htlc, preimage, user.address())
        .await
        .expect("user claim_htlc");
    eprintln!("[e2e] user claimed BTC → {claim_tx}");

    // 4. Orchestrator extracts the preimage from the user's witness and
    //    claims the user's ZION lock via claim_source.
    poll_until(&flow, &swap_id, "phase=Settled (ClaimZion)", |p| {
        *p == BtcSwapPhase::Settled
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    assert_eq!(rec.phase, BtcSwapPhase::Settled);

    let coord = swaps.get_record(&swap_id).await.expect("coordinator record");
    assert_eq!(coord.state, SwapState::Claimed);
    assert_eq!(
        swaps.revealed_preimage(&swap_id).await,
        Some(preimage),
        "coordinator preimage mismatch"
    );
    assert_eq!(coord.release_recipient.as_deref(), Some(op_zion_addr.as_str()));
    eprintln!("[e2e] ZION→BTC swap SETTLED — coord claimed to {}", op_zion_addr);
}

/// User locks ZION → operator locks BTC → user never claims → BTC CLTV
/// expires → orchestrator refunds the BTC lock on-chain (RefundBtc).
#[tokio::test]
#[ignore]
async fn e2e_flow_zion_to_btc_refund() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };

    let (_, op_vk) = zion_core::crypto::generate_keypair();
    let (_, user_vk) = zion_core::crypto::generate_keypair();
    let op_zion_pk: [u8; 32] = *op_vk.as_bytes();
    let user_zion_pk: [u8; 32] = *user_vk.as_bytes();
    let op_zion_addr = zion_core::crypto::derive_address(&op_zion_pk);
    let user_zion_addr = zion_core::crypto::derive_address(&user_zion_pk);

    let (_preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // cltv_before_zion_timeout = tip + floor((ts-now)/600) - margin.
    // Aim CLTV ≈ tip+3: floor((ts-now)/600) = 3 + MARGIN → ts-now = 5400s.
    let zion_timeout = now + (MARGIN_BLOCKS as u64 + 3) * 600;

    let swaps = Arc::new(HtlcSwap::new_offline());
    let cfg = BtcSwapConfig {
        btc_network: op.network(),
        min_btc_confs: MIN_CONFS,
        margin_blocks: MARGIN_BLOCKS,
        operator_zion_pubkey: op_zion_pk,
        operator_zion_address: op_zion_addr,
        operator_btc_dest: None,
        ..BtcSwapConfig::default()
    };
    let flow = BtcSwapFlow::new(btc.clone(), Arc::new(op), swaps.clone(), cfg);

    let tip0 = btc.current_height().await.unwrap();
    let rec = flow
        .offer_zion_to_btc_live(OfferZionToBtc {
            hashlock,
            zion_flowers: 50_000_000,
            btc_sats: SWAP_SATS,
            user_btc_claim: *user.public_key_btc(),
            user_zion_refund: user_zion_pk,
            user_zion_lock_txid: "test-zion-lock-refund".into(),
            user_zion_address: user_zion_addr,
            zion_timeout_ts: zion_timeout,
        })
        .await
        .expect("offer_zion_to_btc");
    let swap_id = rec.swap_id.clone();
    let cltv = rec.btc_htlc.cltv_timeout as u64;
    eprintln!("[e2e] offer {swap_id} cltv={cltv} (tip {tip0})");

    // Operator locks BTC; user never claims.
    poll_until(&flow, &swap_id, "phase=Locked (LockBtc)", |p| {
        *p == BtcSwapPhase::Locked
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    let lock = rec.btc_lock.clone().expect("no btc lock recorded");
    eprintln!("[e2e] operator locked {} sats in {}:{}", lock.value_sats, lock.txid, lock.vout);

    // Advance the tip past the CLTV; the next poll must refund on-chain.
    let need = cltv.saturating_sub(btc.current_height().await.unwrap()) + 1;
    mine_blocks(need).await;
    poll_until(&flow, &swap_id, "phase=Refunded (RefundBtc)", |p| {
        *p == BtcSwapPhase::Refunded
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    let refund_tx = rec.btc_settle_tx.clone().expect("no settle tx");
    eprintln!("[e2e] orchestrator refunded BTC → {refund_tx}");

    // Verify on-chain: spend classified as Refund.
    let spend = wait_for("refund spend detection", {
        let btc = btc.clone();
        let htlc = rec.btc_htlc.clone();
        let lock = lock.clone();
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
            eprintln!("[e2e] ZION→BTC swap REFUNDED on-chain — {txid}");
        }
        other => panic!("expected Refund spend, got {other:?}"),
    }
}

/// User locks BTC → operator locks ZION → user never claims → ZION timeout
/// expires → orchestrator refunds the ZION leg (RefundZion); the user then
/// refunds their BTC after its CLTV — both sides fully recover.
#[tokio::test]
#[ignore]
async fn e2e_flow_btc_to_zion_refund() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();

    let (_, op_vk) = zion_core::crypto::generate_keypair();
    let (_, user_vk) = zion_core::crypto::generate_keypair();
    let op_zion_pk: [u8; 32] = *op_vk.as_bytes();
    let user_zion_pk: [u8; 32] = *user_vk.as_bytes();
    let op_zion_addr = zion_core::crypto::derive_address(&op_zion_pk);
    let user_zion_addr = zion_core::crypto::derive_address(&user_zion_pk);

    let (_preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Short ZION timeout — expires ~45s after offer (wall-clock timelock).
    let zion_timeout = now + 45;

    let swaps = Arc::new(HtlcSwap::new_offline());
    let cfg = BtcSwapConfig {
        btc_network: op.network(),
        min_btc_confs: MIN_CONFS,
        margin_blocks: MARGIN_BLOCKS,
        operator_zion_pubkey: op_zion_pk,
        operator_zion_address: op_zion_addr,
        operator_btc_dest: None,
        ..BtcSwapConfig::default()
    };
    let flow = BtcSwapFlow::new(btc.clone(), Arc::new(op), swaps.clone(), cfg);

    let tip0 = btc.current_height().await.unwrap();
    let rec = flow
        .offer_btc_to_zion_live(OfferBtcToZion {
            hashlock,
            btc_sats: SWAP_SATS,
            zion_flowers: 50_000_000,
            user_btc_refund: *user.public_key_btc(),
            user_zion_claim: user_zion_pk,
            user_zion_address: user_zion_addr,
            zion_timeout_ts: zion_timeout,
        })
        .await
        .expect("offer_btc_to_zion");
    let swap_id = rec.swap_id.clone();
    let cltv = rec.btc_htlc.cltv_timeout as u64;
    eprintln!("[e2e] offer {swap_id} cltv={cltv} (tip {tip0}), zion timeout in 45s");

    let (txid, vout, sats) = user
        .lock_htlc(&client, &api, &rec.btc_htlc, SWAP_SATS)
        .await
        .expect("user lock_htlc");
    eprintln!("[e2e] user locked {sats} sats in {txid}:{vout}");
    mine_blocks(1).await;

    poll_until(&flow, &swap_id, "phase=Locked (LockZion)", |p| {
        *p == BtcSwapPhase::Locked
    })
    .await;
    eprintln!("[e2e] locked; waiting out the 45s ZION timeout");
    tokio::time::sleep(Duration::from_secs(50)).await;

    poll_until(&flow, &swap_id, "phase=Refunded (RefundZion)", |p| {
        *p == BtcSwapPhase::Refunded
    })
    .await;
    let coord = swaps.get_record(&swap_id).await.expect("coordinator record");
    assert_eq!(coord.state, SwapState::Refunded);
    eprintln!("[e2e] orchestrator refunded ZION leg (coord Refunded)");

    // The user recovers their BTC after the HTLC CLTV.
    let rec = flow.record(&swap_id).await.unwrap();
    let lock = rec.btc_lock.clone().expect("no btc lock");
    let need = cltv.saturating_sub(btc.current_height().await.unwrap()) + 1;
    mine_blocks(need).await;
    let utxo = HtlcUtxo {
        outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), lock.vout),
        value_sats: lock.value_sats,
    };
    let refund_tx = user
        .refund_htlc(&client, &api, &utxo, &rec.btc_htlc, user.address())
        .await
        .expect("user refund_htlc");
    eprintln!("[e2e] user refunded BTC → {refund_tx}");

    let spend = wait_for("user refund detection", {
        let btc = btc.clone();
        let htlc = rec.btc_htlc.clone();
        let lock = lock.clone();
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
            eprintln!("[e2e] BTC→ZION swap REFUNDED both legs — preimage never revealed");
        }
        other => panic!("expected Refund spend, got {other:?}"),
    }
    assert_eq!(swaps.revealed_preimage(&swap_id).await, None);
}

/// Crash recovery: kill the flow mid-swap (after both legs locked), rebuild
/// flow + coordinator from the same SQLite file, finish the swap — proves
/// `btc_swap_records` + `htlc_records` persistence end-to-end.
#[tokio::test]
#[ignore]
async fn e2e_flow_btc_to_zion_restart() {
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();

    let (_, op_vk) = zion_core::crypto::generate_keypair();
    let (_, user_vk) = zion_core::crypto::generate_keypair();
    let op_zion_pk: [u8; 32] = *op_vk.as_bytes();
    let user_zion_pk: [u8; 32] = *user_vk.as_bytes();
    let op_zion_addr = zion_core::crypto::derive_address(&op_zion_pk);
    let user_zion_addr = zion_core::crypto::derive_address(&user_zion_pk);

    let (preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let zion_timeout = now + 7 * 24 * 3600;

    let cfg = BtcSwapConfig {
        btc_network: op.network(),
        min_btc_confs: MIN_CONFS,
        margin_blocks: MARGIN_BLOCKS,
        operator_zion_pubkey: op_zion_pk,
        operator_zion_address: op_zion_addr.clone(),
        operator_btc_dest: None,
        ..BtcSwapConfig::default()
    };

    let db_path = std::env::temp_dir().join(format!(
        "warp_restart_{}_{}.db",
        std::process::id(),
        hex::encode(&hashlock[..4])
    ));
    let _ = std::fs::remove_file(&db_path);
    eprintln!("[e2e] db {db_path:?}");

    // ── Phase 1: live flow with persistence ─────────────────────────────
    let db1 = Arc::new(tokio::sync::Mutex::new(Db::open(&db_path).unwrap()));
    let swaps1 = Arc::new(HtlcSwap::with_db(
        Arc::new(ChainAdapterRegistry::new()),
        db1.clone(),
    ));
    let mut flow1 = BtcSwapFlow::new(btc.clone(), Arc::new(op.clone()), swaps1.clone(), cfg.clone());
    flow1.set_db(db1.clone());

    let rec = flow1
        .offer_btc_to_zion_live(OfferBtcToZion {
            hashlock,
            btc_sats: SWAP_SATS,
            zion_flowers: 50_000_000,
            user_btc_refund: *user.public_key_btc(),
            user_zion_claim: user_zion_pk,
            user_zion_address: user_zion_addr.clone(),
            zion_timeout_ts: zion_timeout,
        })
        .await
        .expect("offer_btc_to_zion");
    let swap_id = rec.swap_id.clone();
    let (txid, vout, sats) = user
        .lock_htlc(&client, &api, &rec.btc_htlc, SWAP_SATS)
        .await
        .expect("user lock_htlc");
    eprintln!("[e2e] user locked {sats} sats in {txid}:{vout}");
    mine_blocks(1).await;
    poll_until(&flow1, &swap_id, "phase=Locked", |p| {
        *p == BtcSwapPhase::Locked
    })
    .await;
    eprintln!("[e2e] both legs locked — killing flow (restart)");

    drop(flow1);
    drop(swaps1);
    drop(db1);

    // ── Phase 2: rebuild everything from the DB ─────────────────────────
    let db2 = Arc::new(tokio::sync::Mutex::new(Db::open(&db_path).unwrap()));
    let swaps2 = Arc::new(HtlcSwap::with_db(
        Arc::new(ChainAdapterRegistry::new()),
        db2.clone(),
    ));
    swaps2.load_from_db().await.expect("swaps load_from_db");
    let mut flow2 = BtcSwapFlow::new(btc.clone(), Arc::new(op), swaps2.clone(), cfg);
    flow2.set_db(db2.clone());
    let loaded = flow2.load_from_db().await.expect("flow load_from_db");
    assert!(loaded >= 1, "no swap records restored");

    let rec2 = flow2.record(&swap_id).await.expect("record after restart");
    assert_eq!(rec2.phase, BtcSwapPhase::Locked);
    assert!(rec2.btc_lock.is_some(), "btc lock not restored");
    let coord = swaps2.get_record(&swap_id).await.expect("coord after restart");
    assert!(coord.source_confirmed, "source lock flag not restored");
    eprintln!("[e2e] restart recovered swap {swap_id} (phase Locked)");

    // ── Phase 3: user claims ZION; restarted flow claims BTC ────────────
    let mut t = Transfer::new(
        format!("htlc-claim-{swap_id}"),
        TransferDirection::Htlc,
        zion_endpoint(&op_zion_addr, rec2.zion_flowers),
        zion_endpoint(&user_zion_addr, rec2.zion_flowers),
    );
    t.hashlock = Some(Hash::new(hashlock));
    swaps2
        .claim(&preimage, &user_zion_addr, &mut t)
        .await
        .expect("user zion claim");

    poll_until(&flow2, &swap_id, "phase=Settled (ClaimBtc)", |p| {
        *p == BtcSwapPhase::Settled
    })
    .await;
    let rec2 = flow2.record(&swap_id).await.unwrap();
    let settle_tx = rec2.btc_settle_tx.clone().expect("no settle tx");

    mine_blocks(1).await;
    let lock = rec2.btc_lock.clone().unwrap();
    let spend = wait_for("settle spend detection", {
        let btc = btc.clone();
        let htlc = rec2.btc_htlc.clone();
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
            assert_eq!(txid, settle_tx);
            assert_eq!(p, preimage);
            eprintln!("[e2e] RESTART-RECOVERY swap SETTLED — claim {txid}");
        }
        other => panic!("expected Claim spend, got {other:?}"),
    }
    let _ = std::fs::remove_file(&db_path);
}

/// Raw zion-node JSON-RPC over HTTP POST (the node also accepts a bare
/// JSON body line). Returns the `result` field.
async fn zion_rpc_call(
    client: &reqwest::Client,
    rpc: &str,
    method: &str,
    params: serde_json::Value,
) -> serde_json::Value {
    let resp = client
        .post(format!("http://{rpc}"))
        .json(&serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }))
        .send()
        .await
        .expect("zion rpc send")
        .text()
        .await
        .expect("zion rpc body");
    let env: serde_json::Value = serde_json::from_str(resp.trim()).expect("zion rpc parse");
    env.get("result").cloned().unwrap_or(env)
}

/// `getUtxos` → `SpendableUtxo` list (mirrors the adapter parsing, plus the
/// immature-coinbase exclusion).
async fn zion_rpc_utxos(
    client: &reqwest::Client,
    rpc: &str,
    address: &str,
) -> Vec<zion_core::v31_wallet::SpendableUtxo> {
    let tip = zion_rpc_call(client, rpc, "getChainInfo", serde_json::json!({}))
        .await
        .get("chain_height")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let r = zion_rpc_call(client, rpc, "getUtxos", serde_json::json!({"address": address})).await;
    r.get("utxos")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|u| zion_core::v31_wallet::SpendableUtxo {
            tx_hash: hex::decode(u["tx_hash"].as_str().unwrap_or_default())
                .unwrap()
                .try_into()
                .unwrap(),
            output_index: u["output_index"].as_u64().unwrap_or(0) as u32,
            amount: u["amount"].as_u64().unwrap_or(0),
            address: address.to_string(),
            script: hex::decode(u["script_hex"].as_str().unwrap_or_default())
                .unwrap_or_default(),
            block_height: u["block_height"].as_u64().unwrap_or(0),
            is_coinbase: u["is_coinbase"].as_bool().unwrap_or(false),
        })
        .filter(|u| {
            !u.is_coinbase
                || tip.saturating_sub(u.block_height)
                    >= zion_core::emission::COINBASE_MATURITY
        })
        .collect()
}

/// `submitUtxoTransaction` → tx_id hex, or the rejection reason.
async fn zion_rpc_submit(
    client: &reqwest::Client,
    rpc: &str,
    tx: &zion_core::Transaction,
) -> Result<String, String> {
    let tx_json = serde_json::to_value(tx).map_err(|e| e.to_string())?;
    let r = zion_rpc_call(
        client,
        rpc,
        "submitUtxoTransaction",
        serde_json::json!({"transaction": tx_json}),
    )
    .await;
    if !r.get("accepted").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(format!(
            "submitUtxoTransaction rejected: {}",
            r.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown")
        ));
    }
    r.get("tx_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "submitUtxoTransaction missing tx_id".to_string())
}

/// LIVE-ZION variant: the ZION leg runs on the real ZION L1 chain through
/// `ZionL1Adapter` (real `build_htlc_lock`/`build_htlc_claim` txs), while the
/// BTC leg runs on regtest/signet. Requires — in addition to the BTC env:
///
/// ```bash
/// WARP_ZION_LIVE=1 \
/// WARP_ZION_RPC=127.0.0.1:9445 \           # zion-node JSON-RPC (TCP)
/// WARP_ZION_USER_SECRET="<64-hex>" \       # funded ZION key = the "user"
/// # (or WARP_ZION_USER_MNEMONIC="<24 words>")
/// ```
///
/// Roles: the funded wallet plays the USER — it broadcasts the real L1 HTLC
/// lock (claimant = ephemeral operator). The operator keyring is generated
/// fresh: `build_htlc_claim` spends only the lock UTXO (fee deducted from the
/// claimed amount), so the operator needs **no balance**. The operator
/// mnemonic is printed so the claimed ~lock amount is recoverable.
/// Net cost ≈ lock amount + 1 ZION fee to the ephemeral operator address.
///
/// NOTE: `send_payment` (account-model `submitTransaction`) is legacy V3 and
/// does NOT confirm on the v31-native UTXO chain — the lock path must use
/// `execute_outbound`/`submitUtxoTransaction`.
#[tokio::test]
#[ignore]
async fn e2e_flow_zion_to_btc_live_zion() {
    if std::env::var("WARP_ZION_LIVE").ok().as_deref() != Some("1") {
        eprintln!("SKIP: set WARP_ZION_LIVE=1");
        return;
    }
    let Some((op, user, btc)) = env_or_skip() else {
        eprintln!("SKIP: set WARP_BTC_OPERATOR_WIF + WARP_BTC_USER_WIF");
        return;
    };
    let client = reqwest::Client::new();
    let api = btc.api_urls().to_vec();
    let rpc = std::env::var("WARP_ZION_RPC").expect("WARP_ZION_RPC");
    // Funded USER identity: BIP39 mnemonic or a raw Ed25519 secret (hex).
    let user_keyring = |()| -> Keyring {
        if let Ok(m) = std::env::var("WARP_ZION_USER_MNEMONIC") {
            Keyring::from_mnemonic(&m).expect("user keyring (mnemonic)")
        } else {
            let s = std::env::var("WARP_ZION_USER_SECRET")
                .expect("WARP_ZION_USER_MNEMONIC or WARP_ZION_USER_SECRET");
            Keyring::from_zion_secret(&s).expect("user keyring (secret)")
        }
    };
    let user_kr = user_keyring(());
    let user_zion_pk: [u8; 32] = hex::decode(user_kr.zion_public_key(0, 0).unwrap())
        .unwrap()
        .try_into()
        .unwrap();
    let user_zion_addr = user_kr
        .address(ChainId::ZionL1, 0, 0)
        .unwrap()
        .encoded;

    // Ephemeral operator — claim spends only the lock UTXO, no balance needed.
    // Mnemonic printed so the claimed amount stays recoverable.
    let op_kr = Keyring::generate().expect("operator keyring");
    eprintln!("[e2e] operator (ephemeral) mnemonic: {}", op_kr.mnemonic());
    let op_zion_pk: [u8; 32] = hex::decode(op_kr.zion_public_key(0, 0).unwrap())
        .unwrap()
        .try_into()
        .unwrap();
    let op_zion_addr = op_kr.address(ChainId::ZionL1, 0, 0).unwrap().encoded;
    eprintln!("[e2e] zion user {user_zion_addr} / operator {op_zion_addr}");

    // Sanity: user balance must cover lock + fee. Sum the spendable UTXO set
    // directly — `getAddressInfo`/`balance()` only see the legacy account
    // ledger and miss v31-native UTXOs (hybrid model).
    const ZION_LOCK_FLOWERS: u64 = 2_000_000; // 2 ZION
    const ZION_FEE: u64 = 1_000_000;
    let user_bal: u128 = zion_rpc_utxos(&client, &rpc, &user_zion_addr)
        .await
        .iter()
        .map(|u| u.amount as u128)
        .sum();
    eprintln!("[e2e] user zion balance: {user_bal} flowers (utxo sum)");
    assert!(
        user_bal >= (ZION_LOCK_FLOWERS + ZION_FEE) as u128,
        "user zion balance too low for live test"
    );

    // Coordinator sees a live ZionL1 adapter (ephemeral operator keyring).
    let mut registry = ChainAdapterRegistry::new();
    registry.register(
        ChainId::ZionL1,
        Box::new(ZionL1Adapter::new(rpc.clone(), op_kr.clone())),
    );
    let swaps = Arc::new(HtlcSwap::new(Arc::new(registry)));

    // Test-side adapters (separate instances; adapters are not Clone).
    let signing_key = user_kr.zion_signing_key(0, 0).unwrap();
    let op_side = ZionL1Adapter::new(rpc.clone(), op_kr);
    let user_side = ZionL1Adapter::new(rpc.clone(), user_kr);

    let (preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let zion_timeout = now + 7 * 24 * 3600;

    // 1. User broadcasts a real L1 HTLC lock (claimant = operator). Built
    //    manually with UTXOs *past* the largest-first range — the funded
    //    wallet's payout daemon uses the same largest-first selection, so the
    //    top UTXOs are raced continuously; picking mid-range inputs avoids
    //    the double-spend eviction.
    let skip: usize = std::env::var("WARP_ZION_UTXO_SKIP")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(64);
    let mut utxos = zion_rpc_utxos(&client, &rpc, &user_zion_addr).await;
    utxos.sort_by(|a, b| {
        b.amount
            .cmp(&a.amount)
            .then(a.tx_hash.cmp(&b.tx_hash))
    });
    let spend_utxos: Vec<zion_core::v31_wallet::SpendableUtxo> =
        utxos.into_iter().skip(skip).collect();
    eprintln!(
        "[e2e] building lock from {} utxos (skipped top {skip})",
        spend_utxos.len()
    );
    let build = zion_core::v31_wallet::build_htlc_lock(
        &signing_key,
        &user_zion_addr,
        ZION_LOCK_FLOWERS,
        ZION_FEE,
        &spend_utxos,
        &hashlock,
        zion_timeout,
        &op_zion_pk,
        &user_zion_pk,
    )
    .expect("build htlc lock");
    let zion_lock_txid = zion_rpc_submit(&client, &rpc, &build.transaction)
        .await
        .expect("user htlc lock broadcast");
    let zion_lock_hash = Hash::from_hex(&zion_lock_txid).expect("lock txid hex");
    eprintln!("[e2e] user locked {ZION_LOCK_FLOWERS} flowers on L1 → {zion_lock_txid}");
    wait_for("user zion lock conf", {
        let user_side = &user_side;
        let h = zion_lock_hash;
        move || async move { user_side.confirmations(&h).await.ok().filter(|c| *c >= 1) }
    })
    .await;
    eprintln!("[e2e] user zion lock confirmed");

    // 2. Offer with the real L1 lock txid; orchestrator locks BTC on regtest.
    let swaps_flow = swaps.clone();
    let cfg = BtcSwapConfig {
        btc_network: op.network(),
        min_btc_confs: MIN_CONFS,
        margin_blocks: MARGIN_BLOCKS,
        operator_zion_pubkey: op_zion_pk,
        operator_zion_address: op_zion_addr.clone(),
        operator_btc_dest: None,
        // Exercise the on-chain user-lock verification against the real node.
        zion_rpc_url: Some(rpc.clone()),
        ..BtcSwapConfig::default()
    };
    let flow = BtcSwapFlow::new(btc.clone(), Arc::new(op), swaps_flow, cfg);
    let rec = flow
        .offer_zion_to_btc_live(OfferZionToBtc {
            hashlock,
            zion_flowers: ZION_LOCK_FLOWERS,
            btc_sats: SWAP_SATS,
            user_btc_claim: *user.public_key_btc(),
            user_zion_refund: user_zion_pk,
            user_zion_lock_txid: zion_lock_txid.clone(),
            user_zion_address: user_zion_addr.clone(),
            zion_timeout_ts: zion_timeout,
        })
        .await
        .expect("offer_zion_to_btc");
    let swap_id = rec.swap_id.clone();
    eprintln!("[e2e] offer {swap_id} HTLC {}", rec.btc_htlc.address);

    poll_until(&flow, &swap_id, "phase=Locked (LockBtc)", |p| {
        *p == BtcSwapPhase::Locked
    })
    .await;
    let rec = flow.record(&swap_id).await.unwrap();
    let lock = rec.btc_lock.clone().expect("no btc lock recorded");
    eprintln!("[e2e] operator locked {} sats in {}:{}", lock.value_sats, lock.txid, lock.vout);
    mine_blocks(1).await;

    // 3. User claims the operator's BTC lock — reveals preimage on-chain.
    let utxo = HtlcUtxo {
        outpoint: OutPoint::new(Txid::from_str(&lock.txid).unwrap(), lock.vout),
        value_sats: lock.value_sats,
    };
    let claim_tx = user
        .claim_htlc(&client, &api, &utxo, &rec.btc_htlc, preimage, user.address())
        .await
        .expect("user claim_htlc");
    eprintln!("[e2e] user claimed BTC → {claim_tx}");

    // 4. Orchestrator extracts the preimage and broadcasts the REAL ZION
    //    claim via the live adapter (claim_source → htlc_claim).
    poll_until(&flow, &swap_id, "phase=Settled (ClaimZion)", |p| {
        *p == BtcSwapPhase::Settled
    })
    .await;
    let coord = swaps.get_record(&swap_id).await.expect("coordinator record");
    assert_eq!(coord.state, SwapState::Claimed);
    assert_eq!(coord.release_recipient.as_deref(), Some(op_zion_addr.as_str()));
    assert_eq!(swaps.revealed_preimage(&swap_id).await, Some(preimage));
    let release_tx = coord.release_tx_id.clone().expect("no zion release tx");
    eprintln!("[e2e] operator claimed user zion lock on L1 → {release_tx}");

    // 5. Verify the ZION claim tx confirms on the real chain.
    let release_hash = Hash::from_hex(&release_tx).expect("release tx hex");
    wait_for("zion claim conf", {
        let op_side = &op_side;
        move || async move {
            op_side.confirmations(&release_hash).await.ok().filter(|c| *c >= 1)
        }
    })
    .await;
    eprintln!("[e2e] LIVE-ZION swap SETTLED — zion claim confirmed on L1");
    let _ = ZION_FEE; // documented constant; fees paid by the txs themselves
}
