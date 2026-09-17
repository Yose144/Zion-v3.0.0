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
use zion_multichain::warp::btc_htlc::HtlcUtxo;
use zion_multichain::warp::btc_signer::BtcSigner;
use zion_multichain::warp::btc_swap::{
    BtcSwapConfig, BtcSwapFlow, BtcSwapPhase, OfferBtcToZion, OfferZionToBtc,
};

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
