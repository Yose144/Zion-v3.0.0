//! Proposal engine.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::VoteChoice;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProposalType {
    Parameter {
        parameter_name: String,
        current_value: String,
        proposed_value: String,
    },
    Treasury {
        recipient: String,
        amount: u64,
        purpose: String,
    },
    Emergency {
        action: String,
        justification: String,
    },
    Grant {
        recipient: String,
        amount: u64,
        milestones: Vec<String>,
        duration_days: u32,
    },
    Humanitarian {
        category: String,
        amount: u64,
        region: String,
        description: String,
    },
    Admission {
        candidate_id: String,
        gate_scores_hash: String,
        sponsoring_guardians: Vec<String>,
        community: String,
    },
    Bodhisattva {
        candidate_id: String,
        ceremony_date: String,
        ceremony_location: String,
        vow_text_hash: String,
        physical_symbol: String,
    },
    Expulsion {
        accused_id: String,
        offense_category: String,
        investigation_hash: String,
        defense_hash: Option<String>,
        tier: u8,
    },
    CrossLayer {
        target_layers: Vec<u8>,
        inner_proposal_id: u64,
        description: String,
    },
    ParliamentaryElection {
        title: String,
        parties: Vec<String>,
        seats: u32,
    },
}

impl ProposalType {
    pub fn required_quorum_percent(&self) -> f64 {
        match self {
            ProposalType::Parameter { .. } => 10.0,
            ProposalType::Treasury { .. } => 15.0,
            ProposalType::Emergency { .. } => 20.0,
            ProposalType::Grant { .. } => 10.0,
            ProposalType::Humanitarian { .. } => 10.0,
            ProposalType::Admission { .. } => 60.0,
            ProposalType::Bodhisattva { .. } => 60.0,
            ProposalType::Expulsion { .. } => 75.0,
            ProposalType::CrossLayer { .. } => 15.0,
            ProposalType::ParliamentaryElection { .. } => 15.0,
        }
    }

    pub fn voting_period_secs(&self) -> u64 {
        match self {
            ProposalType::Emergency { .. } => 3 * 24 * 60 * 60,
            ProposalType::Expulsion { .. }
            | ProposalType::Bodhisattva { .. }
            | ProposalType::CrossLayer { .. } => 7 * 24 * 60 * 60,
            _ => 7 * 24 * 60 * 60,
        }
    }

    pub fn type_name(&self) -> &str {
        match self {
            ProposalType::Parameter { .. } => "parameter",
            ProposalType::Treasury { .. } => "treasury",
            ProposalType::Emergency { .. } => "emergency",
            ProposalType::Grant { .. } => "grant",
            ProposalType::Humanitarian { .. } => "humanitarian",
            ProposalType::Admission { .. } => "admission",
            ProposalType::Bodhisattva { .. } => "bodhisattva",
            ProposalType::Expulsion { .. } => "expulsion",
            ProposalType::CrossLayer { .. } => "cross_layer",
            ProposalType::ParliamentaryElection { .. } => "parliamentary_election",
        }
    }

    pub fn uses_consent(&self) -> bool {
        matches!(
            self,
            ProposalType::Admission { .. }
                | ProposalType::Bodhisattva { .. }
                | ProposalType::Expulsion { .. }
        )
    }

    pub fn governing_layer(&self) -> u8 {
        match self {
            ProposalType::Parameter { .. }
            | ProposalType::Treasury { .. }
            | ProposalType::Emergency { .. }
            | ProposalType::Grant { .. }
            | ProposalType::Humanitarian { .. }
            | ProposalType::ParliamentaryElection { .. } => 2,
            ProposalType::Admission { .. }
            | ProposalType::Bodhisattva { .. }
            | ProposalType::Expulsion { .. } => 5,
            ProposalType::CrossLayer { target_layers, .. } => {
                target_layers.first().copied().unwrap_or(2)
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProposalStatus {
    Draft,
    Active,
    Passed,
    Failed,
    Timelocked,
    Executed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proposal {
    pub id: u64,
    pub uuid: String,
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalType,
    pub status: ProposalStatus,
    pub proposer: String,
    pub proposer_balance: u64,
    pub snapshot_block: u64,
    pub votes_for: u64,
    pub votes_against: u64,
    pub votes_abstain: u64,
    pub election_tallies: BTreeMap<String, u64>,
    pub voter_count: u32,
    pub created_at: DateTime<Utc>,
    pub voting_ends_at: DateTime<Utc>,
    pub timelock_ends_at: Option<DateTime<Utc>>,
    pub executed_at: Option<DateTime<Utc>>,
    pub execution_tx: Option<String>,
}

impl Proposal {
    pub fn new(
        id: u64,
        title: String,
        description: String,
        proposal_type: ProposalType,
        proposer: String,
        proposer_balance: u64,
        snapshot_block: u64,
    ) -> Self {
        let now = Utc::now();
        let voting_period = chrono::Duration::seconds(proposal_type.voting_period_secs() as i64);
        Self {
            id,
            uuid: Uuid::new_v4().to_string(),
            title,
            description,
            proposal_type,
            status: ProposalStatus::Active,
            proposer,
            proposer_balance,
            snapshot_block,
            votes_for: 0,
            votes_against: 0,
            votes_abstain: 0,
            election_tallies: BTreeMap::new(),
            voter_count: 0,
            created_at: now,
            voting_ends_at: now + voting_period,
            timelock_ends_at: None,
            executed_at: None,
            execution_tx: None,
        }
    }

    pub fn is_voting_open(&self) -> bool {
        self.status == ProposalStatus::Active && Utc::now() < self.voting_ends_at
    }

    pub fn total_votes(&self) -> u64 {
        self.votes_for + self.votes_against + self.votes_abstain
    }

    pub fn add_vote(&mut self, choice: VoteChoice, weight: u64) {
        match choice {
            VoteChoice::Yes => self.votes_for += weight,
            VoteChoice::No => self.votes_against += weight,
            VoteChoice::Abstain => self.votes_abstain += weight,
            VoteChoice::Candidate(ref party) => {
                *self.election_tallies.entry(party.clone()).or_insert(0) += weight;
                self.votes_for += weight;
            }
        }
        self.voter_count += 1;
    }

    pub fn has_passed(&self) -> bool {
        self.votes_for > self.votes_against
    }

    pub fn allocate_seats(&self) -> BTreeMap<String, u64> {
        if let ProposalType::ParliamentaryElection {
            ref parties, seats, ..
        } = self.proposal_type
        {
            allocate_seats_dhondt(parties, seats, &self.election_tallies)
        } else {
            BTreeMap::new()
        }
    }
}

pub fn allocate_seats_dhondt(
    parties: &[String],
    seats: u32,
    tallies: &BTreeMap<String, u64>,
) -> BTreeMap<String, u64> {
    let seats = seats as u64;
    if parties.is_empty() || seats == 0 || tallies.is_empty() {
        return BTreeMap::new();
    }

    let mut won: BTreeMap<String, u64> = BTreeMap::new();
    let mut votes: BTreeMap<String, u64> = BTreeMap::new();
    for party in parties {
        if let Some(&w) = tallies.get(party) {
            if w > 0 {
                votes.insert(party.clone(), w);
                won.insert(party.clone(), 0);
            }
        }
    }

    for _ in 0..seats {
        let mut best_party: Option<String> = None;
        let mut best_quotient: f64 = 0.0;
        for (party, &party_votes) in &votes {
            let s = won.get(party).copied().unwrap_or(0) as f64;
            let quotient = party_votes as f64 / (s + 1.0);
            if quotient > best_quotient {
                best_quotient = quotient;
                best_party = Some(party.clone());
            }
        }
        if let Some(party) = best_party {
            *won.entry(party).or_insert(0) += 1;
        } else {
            break;
        }
    }
    won
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_proposal() -> Proposal {
        Proposal::new(
            1,
            "Test Proposal".to_string(),
            "This is a test".to_string(),
            ProposalType::Parameter {
                parameter_name: "fee_percent".to_string(),
                current_value: "0.1".to_string(),
                proposed_value: "0.05".to_string(),
            },
            "zion1proposer".to_string(),
            2_000_000_000_000,
            1000,
        )
    }

    #[test]
    fn test_create_proposal() {
        let p = sample_proposal();
        assert_eq!(p.id, 1);
        assert_eq!(p.status, ProposalStatus::Active);
        assert_eq!(p.votes_for, 0);
        assert_eq!(p.voter_count, 0);
        assert!(p.is_voting_open());
    }

    #[test]
    fn test_add_votes() {
        let mut p = sample_proposal();
        p.add_vote(VoteChoice::Yes, 1_000_000_000_000);
        p.add_vote(VoteChoice::No, 500_000_000_000);
        p.add_vote(VoteChoice::Abstain, 100_000_000_000);

        assert_eq!(p.votes_for, 1_000_000_000_000);
        assert_eq!(p.votes_against, 500_000_000_000);
        assert_eq!(p.total_votes(), 1_600_000_000_000);
        assert_eq!(p.voter_count, 3);
        assert!(p.has_passed());
    }

    #[test]
    fn test_proposal_type_quorum() {
        assert_eq!(
            ProposalType::Parameter {
                parameter_name: "x".into(),
                current_value: "1".into(),
                proposed_value: "2".into(),
            }
            .required_quorum_percent(),
            10.0
        );
        assert_eq!(
            ProposalType::Emergency {
                action: "pause".into(),
                justification: "critical".into(),
            }
            .required_quorum_percent(),
            20.0
        );
    }

    #[test]
    fn test_emergency_shorter_voting() {
        let emergency = ProposalType::Emergency {
            action: "pause".into(),
            justification: "urgent".into(),
        };
        assert_eq!(emergency.voting_period_secs(), 3 * 24 * 60 * 60);

        let standard = ProposalType::Grant {
            recipient: "team".into(),
            amount: 1000,
            milestones: vec![],
            duration_days: 30,
        };
        assert_eq!(standard.voting_period_secs(), 7 * 24 * 60 * 60);
    }
}
