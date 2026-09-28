//! Pure quadratic-voting logic tests.

use std::collections::HashSet;
use zion_free_world::quadratic::{
    allocate, ballot_cost, tally, validate_ballot, BallotEntry, QvError,
};

fn entry(grant_id: &str, votes: u32) -> BallotEntry {
    BallotEntry {
        grant_id: grant_id.to_string(),
        votes,
    }
}

fn eligible(ids: &[&str]) -> HashSet<String> {
    ids.iter().map(|s| s.to_string()).collect()
}

// ── ballot_cost / validate_ballot ──

#[test]
fn cost_is_sum_of_squares() {
    let ballot = vec![entry("g1", 3), entry("g2", 4)];
    assert_eq!(ballot_cost(&ballot), Some(9 + 16));
    assert_eq!(ballot_cost(&[]), Some(0));
}

#[test]
fn validate_accepts_at_budget() {
    // 3² + 4² = 25, budget 25 → ok
    let ballot = vec![entry("g1", 3), entry("g2", 4)];
    let cost = validate_ballot(&ballot, &eligible(&["g1", "g2"]), 25).unwrap();
    assert_eq!(cost, 25);
}

#[test]
fn validate_over_budget() {
    let ballot = vec![entry("g1", 3), entry("g2", 4)];
    let err = validate_ballot(&ballot, &eligible(&["g1", "g2"]), 24).unwrap_err();
    assert_eq!(
        err,
        QvError::OverBudget {
            cost: 25,
            budget: 24
        }
    );
}

#[test]
fn validate_huge_votes_no_panic() {
    // u32::MAX² fits in u64 — huge cost but no overflow; any realistic
    // budget → OverBudget, never a panic.
    let single = vec![entry("g1", u32::MAX)];
    let err = validate_ballot(&single, &eligible(&["g1"]), 1000).unwrap_err();
    assert!(matches!(err, QvError::OverBudget { .. }));

    // Two u32::MAX entries overflow u64 → Overflow.
    let ballot = vec![entry("g1", u32::MAX), entry("g2", u32::MAX)];
    let err = validate_ballot(&ballot, &eligible(&["g1", "g2"]), u64::MAX).unwrap_err();
    assert_eq!(err, QvError::Overflow);
}

#[test]
fn validate_rejects_empty() {
    let err = validate_ballot(&[], &eligible(&["g1"]), 100).unwrap_err();
    assert_eq!(err, QvError::Empty);
}

#[test]
fn validate_rejects_duplicate() {
    let ballot = vec![entry("g1", 1), entry("g1", 2)];
    let err = validate_ballot(&ballot, &eligible(&["g1"]), 100).unwrap_err();
    assert_eq!(err, QvError::DuplicateGrant("g1".to_string()));
}

#[test]
fn validate_rejects_unknown() {
    let ballot = vec![entry("nope", 1)];
    let err = validate_ballot(&ballot, &eligible(&["g1"]), 100).unwrap_err();
    assert_eq!(err, QvError::UnknownGrant("nope".to_string()));
}

#[test]
fn validate_rejects_zero_votes() {
    let ballot = vec![entry("g1", 0)];
    let err = validate_ballot(&ballot, &eligible(&["g1"]), 100).unwrap_err();
    assert_eq!(err, QvError::ZeroVotes("g1".to_string()));
}

// ── quadratic property ──

#[test]
fn quadratic_property_single_voter_capped() {
    // One voter with 100 credits can cast at most 10 votes on one grant.
    assert!(validate_ballot(&[entry("g1", 10)], &eligible(&["g1"]), 100).is_ok());
    let err = validate_ballot(&[entry("g1", 11)], &eligible(&["g1"]), 100).unwrap_err();
    assert!(matches!(err, QvError::OverBudget { cost: 121, .. }));
}

#[test]
fn quadratic_property_many_voters_cheap() {
    // Ten voters with 10 credits each can afford 3 votes each (3² = 9 ≤ 10),
    // producing 30 total votes — more than a single rich voter's 10.
    for _ in 0..10 {
        let cost = validate_ballot(&[entry("g1", 3)], &eligible(&["g1"]), 10).unwrap();
        assert_eq!(cost, 9);
    }
    let ballots: Vec<Vec<BallotEntry>> = (0..10).map(|_| vec![entry("g1", 3)]).collect();
    let t = tally(&ballots, &["g1".to_string()]);
    assert_eq!(t[0].votes, 30);
    assert_eq!(t[0].voters, 10);
}

// ── tally ──

#[test]
fn tally_aggregates() {
    let ballots = vec![
        vec![entry("g1", 3), entry("g2", 1)],
        vec![entry("g1", 1), entry("g2", 4)],
    ];
    let grants = vec!["g1".to_string(), "g2".to_string(), "g3".to_string()];
    let t = tally(&ballots, &grants);

    assert_eq!(t.len(), 3);
    assert_eq!(t[0].grant_id, "g1");
    assert_eq!(t[0].votes, 4);
    assert_eq!(t[0].voters, 2);
    assert_eq!(t[0].credits, 10); // 9 + 1

    assert_eq!(t[1].grant_id, "g2");
    assert_eq!(t[1].votes, 5);
    assert_eq!(t[1].voters, 2);
    assert_eq!(t[1].credits, 17); // 1 + 16

    // Grant with no votes still present with zeroes.
    assert_eq!(t[2].grant_id, "g3");
    assert_eq!(t[2].votes, 0);
    assert_eq!(t[2].voters, 0);
    assert_eq!(t[2].credits, 0);
}

#[test]
fn tally_empty_ballots() {
    let t = tally(&[], &["g1".to_string()]);
    assert_eq!(t.len(), 1);
    assert_eq!(t[0].votes, 0);
}

// ── allocate ──

fn item(grant_id: &str, votes: u64, cap: u64) -> (String, u64, u64) {
    (grant_id.to_string(), votes, cap)
}

fn allocated_sum(allocs: &[zion_free_world::quadratic::Allocation]) -> u64 {
    allocs.iter().map(|a| a.allocated_zion).sum()
}

#[test]
fn allocate_proportional_and_invariant() {
    let items = vec![item("g1", 1, 10_000), item("g2", 3, 10_000)];
    let (allocs, unallocated) = allocate(1000, &items);

    assert_eq!(allocated_sum(&allocs) + unallocated, 1000);
    // g2 has 3x the votes of g1 → ~750 vs ~250 (floor dust allowed).
    let g1 = allocs.iter().find(|a| a.grant_id == "g1").unwrap();
    let g2 = allocs.iter().find(|a| a.grant_id == "g2").unwrap();
    assert_eq!(g2.allocated_zion, 750);
    assert!(g1.allocated_zion >= 249 && g1.allocated_zion <= 250);
    assert!(!g1.capped && !g2.capped);
}

#[test]
fn allocate_cap_redistribution() {
    // pool 1000; g1 has 90% of votes but cap 100; g2 gets the rest.
    let items = vec![item("g1", 9, 100), item("g2", 1, 10_000)];
    let (allocs, unallocated) = allocate(1000, &items);

    let g1 = allocs.iter().find(|a| a.grant_id == "g1").unwrap();
    let g2 = allocs.iter().find(|a| a.grant_id == "g2").unwrap();
    assert_eq!(g1.allocated_zion, 100);
    assert!(g1.capped);
    assert_eq!(g2.allocated_zion, 900);
    assert_eq!(allocated_sum(&allocs) + unallocated, 1000);
}

#[test]
fn allocate_all_capped_returns_remainder() {
    let items = vec![item("g1", 5, 100), item("g2", 5, 200)];
    let (allocs, unallocated) = allocate(1000, &items);

    assert_eq!(allocated_sum(&allocs), 300);
    assert_eq!(unallocated, 700);
    assert!(allocs.iter().all(|a| a.capped));
}

#[test]
fn allocate_zero_votes_all_unallocated() {
    let items = vec![item("g1", 0, 100), item("g2", 0, 200)];
    let (allocs, unallocated) = allocate(1000, &items);

    assert!(allocs.iter().all(|a| a.allocated_zion == 0));
    assert_eq!(unallocated, 1000);
}

#[test]
fn allocate_mixed_zero_votes() {
    // A grant with zero votes gets nothing; its cap doesn't consume pool.
    let items = vec![item("g1", 0, 100), item("g2", 5, 10_000)];
    let (allocs, unallocated) = allocate(500, &items);
    let g1 = allocs.iter().find(|a| a.grant_id == "g1").unwrap();
    let g2 = allocs.iter().find(|a| a.grant_id == "g2").unwrap();
    assert_eq!(g1.allocated_zion, 0);
    assert_eq!(g2.allocated_zion, 500);
    assert_eq!(unallocated, 0);
}

#[test]
fn allocate_deterministic_and_sorted() {
    let items = vec![item("b", 3, 10_000), item("a", 1, 10_000)];
    let (allocs, _) = allocate(100, &items);
    let ids: Vec<&str> = allocs.iter().map(|a| a.grant_id.as_str()).collect();
    assert_eq!(ids, vec!["a", "b"]);
}
