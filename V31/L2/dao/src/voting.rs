//! Voting Engine — token-weighted voting (1 ZION = 1 vote).
//!
//! Ported from V3/L2/dao/src/voting.rs.
//! Voters lock their balance at proposal snapshot block.
//! Each address can vote once per proposal.
//! Weight = balance at snapshot block (in atomic units).

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::{DaoError, DaoResult};
use crate::proposal::{Proposal, ProposalStatus};
use crate::types::VoteChoice;

/// A single vote record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    /// Proposal ID
    pub proposal_id: u64,
    /// Voter L1 address
    pub voter: String,
    /// Vote choice
    pub choice: VoteChoice,
    /// Vote weight (balance at snapshot)
    pub weight: u64,
    /// L1 TX hash containing the vote memo
    pub tx_hash: Option<String>,
    /// Timestamp
    pub voted_at: DateTime<Utc>,
}

/// Voting engine — manages votes per proposal.
pub struct VotingEngine {
    /// proposal_id → (voter_address → Vote)
    votes: HashMap<u64, HashMap<String, Vote>>,
}

impl Default for VotingEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl VotingEngine {
    pub fn new() -> Self {
        Self {
            votes: HashMap::new(),
        }
    }

    /// Register an already-persisted vote (used when reloading from DB).
    pub fn load_vote(&mut self, vote: Vote) {
        let proposal_votes = self.votes.entry(vote.proposal_id).or_default();
        proposal_votes.insert(vote.voter.clone(), vote);
    }

    /// Cast a vote on a proposal.
    pub fn cast_vote(
        &mut self,
        proposal: &mut Proposal,
        voter: String,
        choice: VoteChoice,
        weight: u64,
        tx_hash: Option<String>,
    ) -> DaoResult<Vote> {
        if proposal.status != ProposalStatus::Active {
            return Err(DaoError::ProposalNotVotable(proposal.id.to_string()));
        }

        if !proposal.is_voting_open() {
            return Err(DaoError::VotingPeriodEnded(proposal.id.to_string()));
        }

        let proposal_votes = self.votes.entry(proposal.id).or_default();
        if proposal_votes.contains_key(&voter) {
            return Err(DaoError::AlreadyVoted(proposal.id.to_string()));
        }

        let vote = Vote {
            proposal_id: proposal.id,
            voter: voter.clone(),
            choice: choice.clone(),
            weight,
            tx_hash,
            voted_at: Utc::now(),
        };

        proposal.add_vote(choice, weight);
        proposal_votes.insert(voter, vote.clone());

        Ok(vote)
    }

    /// Get all votes for a proposal.
    pub fn get_votes(&self, proposal_id: u64) -> Vec<&Vote> {
        self.votes
            .get(&proposal_id)
            .map(|v| v.values().collect())
            .unwrap_or_default()
    }

    /// Check if an address has already voted.
    pub fn has_voted(&self, proposal_id: u64, voter: &str) -> bool {
        self.votes
            .get(&proposal_id)
            .map(|v| v.contains_key(voter))
            .unwrap_or(false)
    }

    /// Get voter count for a proposal.
    pub fn voter_count(&self, proposal_id: u64) -> u32 {
        self.votes
            .get(&proposal_id)
            .map(|v| v.len() as u32)
            .unwrap_or(0)
    }

    /// Get total vote weight for a proposal.
    pub fn total_weight(&self, proposal_id: u64) -> u64 {
        self.votes
            .get(&proposal_id)
            .map(|v| v.values().map(|vote| vote.weight).sum())
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proposal::ProposalType;

    fn test_proposal() -> Proposal {
        Proposal::new(
            1,
            "Test".into(),
            "Desc".into(),
            ProposalType::Parameter {
                parameter_name: "fee".into(),
                current_value: "0.1".into(),
                proposed_value: "0.05".into(),
            },
            "zion1proposer".into(),
            2_000_000_000_000,
            100,
        )
    }

    #[test]
    fn test_cast_vote() {
        let mut engine = VotingEngine::new();
        let mut proposal = test_proposal();

        let vote = engine
            .cast_vote(
                &mut proposal,
                "zion1voter1".to_string(),
                VoteChoice::Yes,
                1_000_000_000_000,
                None,
            )
            .unwrap();

        assert_eq!(vote.weight, 1_000_000_000_000);
        assert_eq!(vote.choice, VoteChoice::Yes);
        assert_eq!(proposal.votes_for, 1_000_000_000_000);
        assert_eq!(proposal.voter_count, 1);
    }

    #[test]
    fn test_double_vote_rejected() {
        let mut engine = VotingEngine::new();
        let mut proposal = test_proposal();

        engine
            .cast_vote(
                &mut proposal,
                "zion1voter1".to_string(),
                VoteChoice::Yes,
                1_000_000_000_000,
                None,
            )
            .unwrap();

        let result = engine.cast_vote(
            &mut proposal,
            "zion1voter1".to_string(),
            VoteChoice::No,
            1_000_000_000_000,
            None,
        );

        assert!(result.is_err());
        assert!(matches!(result, Err(DaoError::AlreadyVoted(_))));
    }

    #[test]
    fn test_has_voted() {
        let mut engine = VotingEngine::new();
        let mut proposal = test_proposal();

        assert!(!engine.has_voted(1, "zion1voter1"));

        engine
            .cast_vote(
                &mut proposal,
                "zion1voter1".to_string(),
                VoteChoice::Yes,
                1_000_000,
                None,
            )
            .unwrap();

        assert!(engine.has_voted(1, "zion1voter1"));
        assert!(!engine.has_voted(1, "zion1voter2"));
    }

    #[test]
    fn test_total_weight() {
        let mut engine = VotingEngine::new();
        let mut proposal = test_proposal();

        engine
            .cast_vote(&mut proposal, "v1".into(), VoteChoice::Yes, 500, None)
            .unwrap();
        engine
            .cast_vote(&mut proposal, "v2".into(), VoteChoice::No, 300, None)
            .unwrap();

        assert_eq!(engine.total_weight(1), 800);
        assert_eq!(engine.voter_count(1), 2);
    }
}
