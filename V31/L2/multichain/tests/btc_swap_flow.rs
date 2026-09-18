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
    let api = btc.api_url().to_string();

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
    let api = btc.api_url().to_string();

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
    let api = btc.api_url().to_string();

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
    let api = btc.api_url().to_string();

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

/// LIVE-ZION variant: the ZION leg runs on the real ZION L1 chain through
/// `ZionL1Adapter` (real `build_htlc_lock`/`build_htlc_claim` txs), while the
/// BTC leg runs on regtest/signet. Requires — in addition to the BTC env:
///
/// ```bash
/// WARP_ZION_LIVE=1 \
/// WARP_ZION_RPC=127.0.0.1:9445 \            # zion-node JSON-RPC (TCP)
/// WARP_ZION_OPERATOR_MNEMONIC="<24 words>"  # funded operator ZION keyring
/// # or a raw Ed25519 secret instead:
/// WARP_ZION_OPERATOR_SECRET="<64-hex>"      # funded operator ZION key
/// ```
///
/// Flow: a fresh user keyring is generated and funded by the operator
/// (send_payment) → the user broadcasts a real L1 HTLC lock (claimant =
/// operator) via `execute_outbound` → orchestrator locks BTC → user claims
/// BTC → orchestrator `claim_source` broadcasts the real ZION claim and
/// settles. Net cost ≈ a few ZION in fees; locked funds return to operator.
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
    let api = btc.api_url().to_string();
    let rpc = std::env::var("WARP_ZION_RPC").expect("WARP_ZION_RPC");
    // Operator identity: BIP39 mnemonic or a raw Ed25519 secret (hex).
    let op_keyring = |()| -> Keyring {
        if let Ok(m) = std::env::var("WARP_ZION_OPERATOR_MNEMONIC") {
            Keyring::from_mnemonic(&m).expect("operator keyring (mnemonic)")
        } else {
            let s = std::env::var("WARP_ZION_OPERATOR_SECRET").expect(
                "WARP_ZION_OPERATOR_MNEMONIC or WARP_ZION_OPERATOR_SECRET",
            );
            Keyring::from_zion_secret(&s).expect("operator keyring (secret)")
        }
    };
    let op_kr = op_keyring(());
    let op_zion_pk: [u8; 32] = hex::decode(op_kr.zion_public_key(0, 0).unwrap())
        .unwrap()
        .try_into()
        .unwrap();
    let op_zion_addr = op_kr.address(ChainId::ZionL1, 0, 0).unwrap().encoded;

    // Fresh ephemeral user keyring (its lock is claimed back to operator).
    let user_kr = Keyring::generate().expect("user keyring");
    let user_zion_pk: [u8; 32] = hex::decode(user_kr.zion_public_key(0, 0).unwrap())
        .unwrap()
        .try_into()
        .unwrap();
    let user_zion_addr = user_kr
        .address(ChainId::ZionL1, 0, 0)
        .unwrap()
        .encoded;
    eprintln!("[e2e] zion operator {op_zion_addr} / user {user_zion_addr}");

    // Sanity: operator balance must cover funding + claim fees.
    let op_addr_t = Address::new(
        ChainId::ZionL1,
        op_zion_addr.as_bytes().to_vec(),
        op_zion_addr.clone(),
    )
    .unwrap();
    let op_side_probe = ZionL1Adapter::new(rpc.clone(), op_keyring(()));
    let op_bal = op_side_probe
        .balance(&op_addr_t)
        .await
        .expect("operator balance query");
    eprintln!("[e2e] operator zion balance: {} flowers", op_bal.0);
    assert!(
        op_bal.0 >= 20_000_000,
        "operator zion balance too low for live test"
    );

    // Coordinator sees a live ZionL1 adapter (operator keyring).
    let mut registry = ChainAdapterRegistry::new();
    registry.register(
        ChainId::ZionL1,
        Box::new(ZionL1Adapter::new(rpc.clone(), op_keyring(()))),
    );
    let swaps = Arc::new(HtlcSwap::new(Arc::new(registry)));

    // Test-side adapters (separate instances; adapters are not Clone).
    let op_side = ZionL1Adapter::new(rpc.clone(), op_kr);
    let user_side = ZionL1Adapter::new(rpc.clone(), user_kr);

    const ZION_LOCK_FLOWERS: u64 = 5_000_000; // 5 ZION
    const ZION_FUND_FLOWERS: u64 = 12_000_000; // lock + fees + slack
    const ZION_FEE: u64 = 1_000_000;

    // 0. Fund the fresh user wallet (real tx).
    let fund_to = Address::new(
        ChainId::ZionL1,
        user_zion_addr.as_bytes().to_vec(),
        user_zion_addr.clone(),
    )
    .unwrap();
    let fund_tx = op_side
        .send_payment(&fund_to, Amount::new(ZION_FUND_FLOWERS as u128))
        .await
        .expect("fund user wallet");
    eprintln!("[e2e] funded user {ZION_FUND_FLOWERS} flowers → {}", fund_tx.to_hex());
    wait_for("user funding conf", {
        let op_side = &op_side;
        let fund_tx = fund_tx;
        move || async move {
            op_side.confirmations(&fund_tx).await.ok().filter(|c| *c >= 1)
        }
    })
    .await;
    eprintln!("[e2e] user funding confirmed");

    let (preimage, hashlock) = fresh_preimage();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let zion_timeout = now + 7 * 24 * 3600;

    // 1. User broadcasts a real L1 HTLC lock (claimant = operator).
    let mut user_lock_t = Transfer::new(
        format!("htlc-lock-{}", hex::encode(hashlock)),
        TransferDirection::Htlc,
        zion_endpoint(&user_zion_addr, ZION_LOCK_FLOWERS),
        zion_endpoint(&op_zion_addr, ZION_LOCK_FLOWERS),
    );
    user_lock_t.hashlock = Some(Hash::new(hashlock));
    user_lock_t.timelock = Some(zion_timeout);
    user_lock_t.source_pubkey = Some(user_zion_pk); // user refund key
    user_lock_t.target_pubkey = Some(op_zion_pk); // operator claim key
    let zion_lock_hash = user_side
        .execute_outbound(&user_lock_t)
        .await
        .expect("user htlc lock broadcast");
    let zion_lock_txid = zion_lock_hash.to_hex();
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
