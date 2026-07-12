//! Dutch auction engine for swap intents.
//!
//! The engine holds open auctions for submitted intents. Solvers submit bids
//! during a short auction window (default 5 seconds). When the auction is
//! settled, the bid with the highest guaranteed `amount_out` wins (best price
//! for the user). If no bids were submitted, the intent is marked `Expired`.
//!
//! In a true Dutch auction the price improves for the user over time, so
//! later bids generally offer higher `amount_out`; the engine simply selects
//! the best bid regardless of when it arrived.

use crate::errors::{Error, Result};
use crate::types::{IntentStatus, SolverBid, SwapIntent};
use std::collections::HashMap;
use uuid::Uuid;

/// A single auction for one swap intent.
#[derive(Debug, Clone)]
pub struct Auction {
    /// The intent being auctioned.
    pub intent: SwapIntent,
    /// Bids collected so far.
    pub bids: Vec<SolverBid>,
    /// Auction start time (unix seconds).
    pub start_time: u64,
    /// The winning bid, once settled.
    pub settled: Option<SolverBid>,
}

impl Auction {
    fn new(intent: SwapIntent, start_time: u64) -> Self {
        Self {
            intent,
            bids: Vec::new(),
            start_time,
            settled: None,
        }
    }
}

/// The Dutch auction engine.
pub struct AuctionEngine {
    intents: HashMap<Uuid, Auction>,
    /// Tracks `(user, nonce)` pairs to prevent replay attacks.
    seen_nonces: HashMap<(String, u64), Uuid>,
    auction_duration_secs: u64,
    min_bids: usize,
}

impl Default for AuctionEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AuctionEngine {
    /// Creates a new engine with the default 5-second auction window and a
    /// minimum of 1 bid to settle.
    pub fn new() -> Self {
        Self {
            intents: HashMap::new(),
            seen_nonces: HashMap::new(),
            auction_duration_secs: 5,
            min_bids: 1,
        }
    }

    /// Creates an engine with a custom auction window and minimum bid count.
    pub fn with_config(auction_duration_secs: u64, min_bids: usize) -> Self {
        Self {
            intents: HashMap::new(),
            seen_nonces: HashMap::new(),
            auction_duration_secs,
            min_bids,
        }
    }

    /// Submit a new intent for auctioning.
    ///
    /// Returns [`Error::Replay`] if an intent with the same `(user, nonce)`
    /// has already been submitted.
    pub fn submit_intent(&mut self, mut intent: SwapIntent) -> Result<Uuid> {
        let key = (intent.user.clone(), intent.nonce);
        if self.seen_nonces.contains_key(&key) {
            return Err(Error::Replay {
                user: intent.user.clone(),
                nonce: intent.nonce,
            });
        }
        intent.status = IntentStatus::Pending;
        let id = intent.id;
        let start_time = current_unix();
        self.seen_nonces.insert(key, id);
        self.intents.insert(id, Auction::new(intent, start_time));
        Ok(id)
    }

    /// Submit a solver bid for an intent.
    pub fn submit_bid(&mut self, bid: SolverBid) -> Result<()> {
        let auction = self
            .intents
            .get_mut(&bid.intent_id)
            .ok_or(Error::IntentNotFound(bid.intent_id))?;

        if auction.intent.status != IntentStatus::Pending {
            return Err(Error::NotAcceptingBids(
                bid.intent_id,
                auction.intent.status.to_string(),
            ));
        }
        if auction.intent.is_expired(current_unix()) {
            auction.intent.status = IntentStatus::Expired;
            return Err(Error::Expired(bid.intent_id, auction.intent.deadline));
        }

        // Reject bids that don't meet the user's minimum output.
        if bid.amount_out < auction.intent.min_amount_out {
            return Err(Error::BidBelowMinimum {
                amount_out: bid.amount_out.to_string(),
                min_amount_out: auction.intent.min_amount_out.to_string(),
            });
        }

        auction.bids.push(bid);
        Ok(())
    }

    /// Settle an auction: pick the bid with the highest `amount_out`.
    ///
    /// If there are no bids, the intent is marked [`IntentStatus::Expired`].
    /// If there are fewer than `min_bids` bids, the intent is also expired.
    pub fn settle_auction(&mut self, intent_id: Uuid) -> Result<SolverBid> {
        let auction = self
            .intents
            .get_mut(&intent_id)
            .ok_or(Error::IntentNotFound(intent_id))?;

        if auction.intent.status != IntentStatus::Pending {
            return Err(Error::NotAcceptingBids(
                intent_id,
                auction.intent.status.to_string(),
            ));
        }

        if auction.bids.len() < self.min_bids {
            auction.intent.status = IntentStatus::Expired;
            return Err(Error::NoBids(intent_id));
        }

        // Pick the best bid: highest guaranteed amount_out (best price for user).
        // Ties broken by lower fee_bps, then earlier timestamp.
        let best_idx = auction
            .bids
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| {
                a.amount_out
                    .cmp(&b.amount_out)
                    .then_with(|| b.fee_bps.cmp(&a.fee_bps))
                    .then_with(|| b.timestamp.cmp(&a.timestamp))
            })
            .map(|(i, _)| i)
            .ok_or(Error::NoBids(intent_id))?;

        let winner = auction.bids[best_idx].clone();
        auction.intent.status = IntentStatus::Settled;
        auction.settled = Some(winner.clone());
        Ok(winner)
    }

    /// Returns a reference to the auction for `intent_id`, if any.
    pub fn get_auction(&self, intent_id: Uuid) -> Option<&Auction> {
        self.intents.get(&intent_id)
    }

    /// Returns a mutable reference to the auction for `intent_id`, if any.
    pub fn get_auction_mut(&mut self, intent_id: Uuid) -> Option<&mut Auction> {
        self.intents.get_mut(&intent_id)
    }

    /// Expire all intents whose deadline is <= `now`.
    ///
    /// Returns the list of intent ids that were newly expired.
    pub fn expire_old(&mut self, now: u64) -> Vec<Uuid> {
        let mut expired = Vec::new();
        for auction in self.intents.values_mut() {
            if auction.intent.status == IntentStatus::Pending && auction.intent.is_expired(now) {
                auction.intent.status = IntentStatus::Expired;
                expired.push(auction.intent.id);
            }
        }
        expired
    }

    /// Cancel an intent. Only the original user may cancel.
    pub fn cancel_intent(&mut self, intent_id: Uuid, user: &str) -> Result<()> {
        let auction = self
            .intents
            .get_mut(&intent_id)
            .ok_or(Error::IntentNotFound(intent_id))?;

        if auction.intent.user != user {
            return Err(Error::NotOwner(user.to_string(), intent_id));
        }
        if auction.intent.status != IntentStatus::Pending {
            return Err(Error::NotAcceptingBids(
                intent_id,
                auction.intent.status.to_string(),
            ));
        }
        auction.intent.status = IntentStatus::Cancelled;
        Ok(())
    }

    /// Number of currently-tracked auctions.
    pub fn len(&self) -> usize {
        self.intents.len()
    }

    /// True if the engine holds no auctions.
    pub fn is_empty(&self) -> bool {
        self.intents.is_empty()
    }

    /// Auction window in seconds.
    pub fn auction_duration_secs(&self) -> u64 {
        self.auction_duration_secs
    }
}

fn current_unix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
