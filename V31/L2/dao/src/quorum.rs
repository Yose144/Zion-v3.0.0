//! Quorum checks.

use crate::error::{DaoError, DaoResult};
use crate::proposal::Proposal;

pub fn check_quorum(proposal: &Proposal, circulating_supply: u64) -> DaoResult<bool> {
    let required_percent = proposal.proposal_type.required_quorum_percent();
    let total_votes = proposal.total_votes();
    let required_votes = (circulating_supply as f64 * required_percent / 100.0) as u64;

    let quorum_met = total_votes >= required_votes;

    if !quorum_met {
        let actual_percent = if circulating_supply > 0 {
            (total_votes as f64 / circulating_supply as f64) * 100.0
        } else {
            0.0
        };
        return Err(DaoError::QuorumNotReached {
            needed: required_percent,
            got: actual_percent,
        });
    }

    Ok(quorum_met)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proposal::ProposalType;
    use crate::types::VoteChoice;

    #[test]
    fn test_quorum_met() {
        let mut p = Proposal::new(
            1,
            "Test".into(),
            "Desc".into(),
            ProposalType::Parameter {
                parameter_name: "fee".into(),
                current_value: "1".into(),
                proposed_value: "2".into(),
            },
            "zion1p".into(),
            2_000_000_000_000,
            100,
        );

        let circulating = 1_000_000_000_000u64;
        p.add_vote(VoteChoice::Yes, 200_000_000_000);

        assert!(check_quorum(&p, circulating).is_ok());
    }

    #[test]
    fn test_quorum_not_met() {
        let mut p = Proposal::new(
            1,
            "Test".into(),
            "Desc".into(),
            ProposalType::Parameter {
                parameter_name: "fee".into(),
                current_value: "1".into(),
                proposed_value: "2".into(),
            },
            "zion1p".into(),
            2_000_000_000_000,
            100,
        );

        let circulating = 1_000_000_000_000u64;
        p.add_vote(VoteChoice::Yes, 1_000_000);

        assert!(check_quorum(&p, circulating).is_err());
    }
}
