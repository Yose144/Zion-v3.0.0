use zion_dao::proposal::{Proposal, ProposalStatus, ProposalType};
use zion_dao::quorum::check_quorum;
use zion_dao::timelock::Timelock;
use zion_dao::types::VoteChoice;

#[test]
fn proposal_and_quorum_construct() {
    let mut p = Proposal::new(
        1,
        "Treasury spend".into(),
        "Fund public goods".into(),
        ProposalType::Treasury {
            recipient: "zion1beneficiary".into(),
            amount: 10_000_000_000_000,
            purpose: "Public goods".into(),
        },
        "zion1proposer".into(),
        2_000_000_000_000,
        1000,
    );

    assert_eq!(p.id, 1);
    assert_eq!(p.status, ProposalStatus::Active);
    assert!(p.is_voting_open());

    p.add_vote(VoteChoice::Yes, 20_000_000_000_000);
    p.add_vote(VoteChoice::No, 5_000_000_000_000);

    assert!(p.has_passed());
    assert!(check_quorum(&p, 100_000_000_000_000).is_ok());
}

#[test]
fn timelock_construct_and_active() {
    let t = Timelock::new(1);
    assert_eq!(t.proposal_id, 1);
    assert!(!t.executed);
    assert!(t.is_active());
    assert!(!t.is_ready());
}
