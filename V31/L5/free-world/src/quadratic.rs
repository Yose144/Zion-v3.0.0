//! Quadratic voting (QV) logic for Free World grant rounds.
//!
//! Pure functions — no DB, no I/O. QV here is *advisory*: it produces an
//! allocation proposal for the matching pool; money still moves only via the
//! existing DAO submit path.
//!
//! Cost model: a ballot entry of `v` votes on a grant costs `v²` voice
//! credits. Each voter has `credits_per_voter` credits per round.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use thiserror::Error;

/// One line of a voter's ballot: `votes` voice-credit votes on `grant_id`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BallotEntry {
    pub grant_id: String,
    pub votes: u32,
}

/// Total voice-credit cost of a ballot: Σ votes².
/// Returns `None` on arithmetic overflow.
pub fn ballot_cost(entries: &[BallotEntry]) -> Option<u64> {
    let mut total: u64 = 0;
    for e in entries {
        let sq = (e.votes as u64).checked_mul(e.votes as u64)?;
        total = total.checked_add(sq)?;
    }
    Some(total)
}

#[derive(Error, Debug, PartialEq, Eq)]
pub enum QvError {
    #[error("ballot is empty")]
    Empty,
    #[error("duplicate grant in ballot: {0}")]
    DuplicateGrant(String),
    #[error("grant is not part of this round: {0}")]
    UnknownGrant(String),
    #[error("zero votes for grant: {0}")]
    ZeroVotes(String),
    #[error("ballot cost {cost} exceeds credit budget {budget}")]
    OverBudget { cost: u64, budget: u64 },
    #[error("ballot cost overflow")]
    Overflow,
}

/// Validate a ballot against the round's eligible grants and the voter's
/// credit budget. Returns the ballot's credit cost on success.
pub fn validate_ballot(
    entries: &[BallotEntry],
    eligible: &HashSet<String>,
    credits_per_voter: u64,
) -> Result<u64, QvError> {
    if entries.is_empty() {
        return Err(QvError::Empty);
    }
    let mut seen: HashSet<&str> = HashSet::with_capacity(entries.len());
    for e in entries {
        if e.votes == 0 {
            return Err(QvError::ZeroVotes(e.grant_id.clone()));
        }
        if !seen.insert(e.grant_id.as_str()) {
            return Err(QvError::DuplicateGrant(e.grant_id.clone()));
        }
        if !eligible.contains(&e.grant_id) {
            return Err(QvError::UnknownGrant(e.grant_id.clone()));
        }
    }
    let cost = ballot_cost(entries).ok_or(QvError::Overflow)?;
    if cost > credits_per_voter {
        return Err(QvError::OverBudget {
            cost,
            budget: credits_per_voter,
        });
    }
    Ok(cost)
}

/// Per-grant aggregated result of a round.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GrantTally {
    pub grant_id: String,
    /// Total voice-credit votes (Σ votes, not squared).
    pub votes: u64,
    /// Number of ballots that included this grant.
    pub voters: u64,
    /// Total voice credits spent on this grant (Σ votes²).
    pub credits: u64,
}

/// Tally all ballots. Every grant in `round_grants` appears in the output
/// even with zero votes; output is sorted by grant_id.
pub fn tally(ballots: &[Vec<BallotEntry>], round_grants: &[String]) -> Vec<GrantTally> {
    let mut map: BTreeMap<String, GrantTally> = round_grants
        .iter()
        .map(|g| {
            (
                g.clone(),
                GrantTally {
                    grant_id: g.clone(),
                    votes: 0,
                    voters: 0,
                    credits: 0,
                },
            )
        })
        .collect();

    for ballot in ballots {
        for e in ballot {
            // Ballots are validated against the round's grants before being
            // stored; skip anything else defensively.
            if let Some(t) = map.get_mut(&e.grant_id) {
                let v = e.votes as u64;
                t.votes = t.votes.saturating_add(v);
                t.voters = t.voters.saturating_add(1);
                t.credits = t.credits.saturating_add(v.saturating_mul(v));
            }
        }
    }

    map.into_values().collect()
}

/// Allocation result for one grant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Allocation {
    pub grant_id: String,
    pub votes: u64,
    /// The grant's requested amount (the cap).
    pub requested_zion: u64,
    pub allocated_zion: u64,
    /// True when the grant's share was limited by its requested amount.
    pub capped: bool,
}

/// Water-filling allocation: split `pool` proportionally to votes among
/// grants that have not reached their cap (requested amount).
///
/// Each round: every uncapped grant's share is
/// `floor(remaining_pool * votes / remaining_votes)`. Grants whose share
/// reaches their cap are fixed at the cap and removed; the remaining pool is
/// then re-split among the rest. Stops when no grant caps in a round.
///
/// Returns `(allocations sorted by grant_id, unallocated)`. Invariant:
/// `Σ allocated_zion + unallocated == pool`. Deterministic.
pub fn allocate(pool: u64, items: &[(String, u64, u64)]) -> (Vec<Allocation>, u64) {
    let mut remaining = pool;

    // Deterministic processing order.
    let mut order: Vec<(String, u64, u64)> = items.to_vec();
    order.sort_by(|a, b| a.0.cmp(&b.0));

    let mut allocated: BTreeMap<String, (u64, bool)> = BTreeMap::new();

    // Active set: grants with votes and not yet capped.
    let mut active: Vec<(String, u64, u64)> = order
        .iter()
        .filter(|(_, votes, cap)| *votes > 0 && *cap > 0)
        .cloned()
        .collect();

    loop {
        let total_votes: u128 = active.iter().map(|(_, v, _)| *v as u128).sum();
        if active.is_empty() || total_votes == 0 || remaining == 0 {
            break;
        }

        // All shares in a round are computed against the same pool snapshot.
        let slice = remaining;
        let mut still_open: Vec<(String, u64, u64)> = Vec::new();
        let mut any_capped = false;

        for (grant_id, votes, cap) in &active {
            let share = (slice as u128 * *votes as u128 / total_votes) as u64;
            if share >= *cap {
                allocated.insert(grant_id.clone(), (*cap, true));
                remaining = remaining.saturating_sub(*cap);
                any_capped = true;
            } else {
                still_open.push((grant_id.clone(), *votes, *cap));
            }
        }

        if !any_capped {
            // Nobody capped this round — distribute the remaining pool
            // proportionally (floor). The rounding dust becomes unallocated.
            let open_votes: u128 = still_open.iter().map(|(_, v, _)| *v as u128).sum();
            for (grant_id, votes, _) in still_open {
                let share = (slice as u128 * votes as u128 / open_votes) as u64;
                allocated.insert(grant_id, (share, false));
                remaining = remaining.saturating_sub(share);
            }
            break;
        }

        active = still_open;
    }

    let allocations: Vec<Allocation> = order
        .into_iter()
        .map(|(grant_id, votes, cap)| {
            let (allocated_zion, capped) = allocated.get(&grant_id).copied().unwrap_or((0, false));
            Allocation {
                grant_id,
                votes,
                requested_zion: cap,
                allocated_zion,
                capped,
            }
        })
        .collect();

    (allocations, remaining)
}
