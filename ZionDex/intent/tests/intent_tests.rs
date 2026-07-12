//! Integration tests for the ZionDex intent crate.
//!
//! These tests exercise intent creation, signing/verification, the auction
//! engine (settlement, no-bid expiry, single-bid, intent expiry, cancel,
//! replay protection). They do not require a running router.

use ziondex_intent::auction::AuctionEngine;
use ziondex_intent::signing::{sign_intent_evm, verify_intent_evm};
use ziondex_intent::types::{ChainId, IntentStatus, PathHop, SolverBid, SwapIntent};
use ethers::types::U256;
use uuid::Uuid;

/// Deterministic EVM test key (the well-known Hardhat/Anish key #0).
const TEST_SK: &str = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

fn test_address() -> String {
    // Address corresponding to TEST_SK.
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".to_string()
}

fn fresh_intent(nonce: u64, deadline: u64) -> SwapIntent {
    SwapIntent::new(
        test_address(),
        ChainId::Base,
        ChainId::Arbitrum,
        "USDC",
        "USDC",
        U256::from(1_000_000u64),
        U256::from(900_000u64),
        deadline,
        nonce,
    )
}

fn far_future_deadline() -> u64 {
    9_999_999_999
}

fn make_bid(intent_id: Uuid, amount_out: u64) -> SolverBid {
    SolverBid::new(
        intent_id,
        "0xSOLVER",
        U256::from(amount_out),
        vec![PathHop {
            chain: "base".into(),
            dex: "ziondex-amm".into(),
            from_token: "USDC".into(),
            to_token: "USDC".into(),
            is_bridge: false,
        }],
        10,
        0,
    )
}

#[test]
fn test_create_intent() {
    let intent = fresh_intent(1, far_future_deadline());
    assert_eq!(intent.status, IntentStatus::Pending);
    assert_eq!(intent.from_chain, ChainId::Base);
    assert_eq!(intent.to_chain, ChainId::Arbitrum);
    assert_eq!(intent.amount_in, U256::from(1_000_000u64));
    assert_eq!(intent.min_amount_out, U256::from(900_000u64));
    assert!(intent.signature.is_empty());
    // Fresh UUID is non-zero.
    assert_ne!(intent.id, Uuid::nil());
    // Not expired far in the future.
    assert!(!intent.is_expired(100));
}

#[test]
fn test_sign_and_verify_evm() {
    let mut intent = fresh_intent(2, far_future_deadline());
    let sig = sign_intent_evm(&intent, TEST_SK).unwrap();
    assert_eq!(sig.len(), 65);
    intent.signature = sig.clone();

    // Correct address verifies.
    assert!(verify_intent_evm(&intent, &sig, &test_address()));
    // Wrong address does not verify.
    assert!(!verify_intent_evm(
        &intent,
        &sig,
        "0x2222222222222222222222222222222222222222"
    ));
    // Tampered signature does not verify.
    let mut bad = sig.clone();
    bad[0] ^= 0xff;
    assert!(!verify_intent_evm(&intent, &bad, &test_address()));
}

#[test]
fn test_auction_submit_and_settle() {
    let mut engine = AuctionEngine::new();
    let intent = fresh_intent(3, far_future_deadline());
    let id = engine.submit_intent(intent).unwrap();

    // Two competing bids; the second offers a better amount_out.
    engine.submit_bid(make_bid(id, 950_000)).unwrap();
    engine.submit_bid(make_bid(id, 970_000)).unwrap();

    let winner = engine.settle_auction(id).unwrap();
    assert_eq!(winner.amount_out, U256::from(970_000u64));

    let auction = engine.get_auction(id).unwrap();
    assert_eq!(auction.intent.status, IntentStatus::Settled);
    assert!(auction.settled.is_some());
}

#[test]
fn test_auction_no_bids() {
    let mut engine = AuctionEngine::new();
    let intent = fresh_intent(4, far_future_deadline());
    let id = engine.submit_intent(intent).unwrap();

    let err = engine.settle_auction(id).unwrap_err();
    assert!(matches!(
        err,
        ziondex_intent::Error::NoBids(_) | ziondex_intent::Error::NotAcceptingBids(_, _)
    ) || err.to_string().contains("no bids")
        || err.to_string().contains("not accepting"));

    // With no bids and a settle attempt, the intent is expired.
    let auction = engine.get_auction(id).unwrap();
    assert_eq!(auction.intent.status, IntentStatus::Expired);
}

#[test]
fn test_auction_single_bid() {
    let mut engine = AuctionEngine::new();
    let intent = fresh_intent(5, far_future_deadline());
    let id = engine.submit_intent(intent).unwrap();

    // A single bid that meets min_amount_out should win.
    engine.submit_bid(make_bid(id, 920_000)).unwrap();
    let winner = engine.settle_auction(id).unwrap();
    assert_eq!(winner.amount_out, U256::from(920_000u64));

    let auction = engine.get_auction(id).unwrap();
    assert_eq!(auction.intent.status, IntentStatus::Settled);
}

#[test]
fn test_intent_expiry() {
    let mut engine = AuctionEngine::new();
    // Deadline already in the past relative to "now".
    let intent = fresh_intent(6, 1);
    let id = engine.submit_intent(intent).unwrap();

    let expired = engine.expire_old(2_000_000_000);
    assert!(expired.contains(&id));

    let auction = engine.get_auction(id).unwrap();
    assert_eq!(auction.intent.status, IntentStatus::Expired);
}

#[test]
fn test_cancel_intent() {
    let mut engine = AuctionEngine::new();
    let intent = fresh_intent(7, far_future_deadline());
    let id = engine.submit_intent(intent).unwrap();

    engine.cancel_intent(id, &test_address()).unwrap();
    let auction = engine.get_auction(id).unwrap();
    assert_eq!(auction.intent.status, IntentStatus::Cancelled);

    // A non-owner cannot cancel.
    let intent2 = fresh_intent(8, far_future_deadline());
    let id2 = engine.submit_intent(intent2).unwrap();
    let err = engine.cancel_intent(id2, "0xNOTOWNER").unwrap_err();
    assert!(err.to_string().contains("not the owner"));
}

#[test]
fn test_replay_protection() {
    let mut engine = AuctionEngine::new();
    let intent_a = fresh_intent(42, far_future_deadline());
    engine.submit_intent(intent_a).unwrap();

    // Same user + same nonce must be rejected.
    let intent_b = fresh_intent(42, far_future_deadline());
    let err = engine.submit_intent(intent_b).unwrap_err();
    assert!(err.to_string().contains("replay"));

    // A different nonce for the same user is fine.
    let intent_c = fresh_intent(43, far_future_deadline());
    engine.submit_intent(intent_c).unwrap();
}

#[test]
fn test_bid_below_minimum_rejected() {
    let mut engine = AuctionEngine::new();
    let intent = fresh_intent(9, far_future_deadline());
    let id = engine.submit_intent(intent).unwrap();

    // min_amount_out is 900_000; a bid below that must be rejected.
    let err = engine.submit_bid(make_bid(id, 800_000)).unwrap_err();
    assert!(err.to_string().contains("below"));
    assert!(engine.get_auction(id).unwrap().bids.is_empty());
}
