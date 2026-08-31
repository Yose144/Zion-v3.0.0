//! Governance Runtime — ties together proposals, voting, quorum, and timelock.
//!
//! This is the in-memory governance engine that the DAO HTTP API and L1 scanner
//! interact with. It manages the full proposal lifecycle:
//!
//! ```text
//! Create → Vote → Tally → Quorum Check → Timelock → Execute
//! ```

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use tracing::warn;

use crate::config::DaoConfig;
use crate::db::DaoDb;
use crate::error::{DaoError, DaoResult};
use crate::metrics::DaoMetrics;
use crate::proposal::{Proposal, ProposalStatus, ProposalType};
use crate::quorum::check_quorum;
use crate::timelock::Timelock;
use crate::types::{VoteChoice, PROPOSAL_THRESHOLD};
use crate::voting::{Vote, VotingEngine};

/// Governance runtime state.
pub struct GovernanceRuntime {
    config: DaoConfig,
    proposals: BTreeMap<u64, Proposal>,
    voting: VotingEngine,
    timelocks: BTreeMap<u64, Timelock>,
    next_proposal_id: u64,
    circulating_supply: u64,
    db: Option<Arc<Mutex<DaoDb>>>,
    metrics: Option<Arc<DaoMetrics>>,
}

impl GovernanceRuntime {
    /// Create a new runtime with the given config and circulating supply.
    pub fn new(config: DaoConfig, circulating_supply: u64) -> Self {
        Self {
            config,
            proposals: BTreeMap::new(),
            voting: VotingEngine::new(),
            timelocks: BTreeMap::new(),
            next_proposal_id: 1,
            circulating_supply,
            db: None,
            metrics: None,
        }
    }

    /// Attach a SQLite DAO database for persistence.
    pub fn with_db(mut self, db: Arc<Mutex<DaoDb>>) -> Self {
        self.db = Some(db);
        self
    }

    /// Attach shared metrics counters.
    pub fn with_metrics(mut self, metrics: Arc<DaoMetrics>) -> Self {
        self.metrics = Some(metrics);
        self
    }

    /// Load proposals and votes from the attached database.
    pub fn load_from_db(&mut self) -> DaoResult<()> {
        let db = match self.db.as_ref() {
            Some(db) => db,
            None => return Ok(()),
        };

        let db = db.lock().map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = db.load_all_proposals()?;

        for row in rows {
            let id = row.id;
            let proposal = row.to_proposal()?;

            let votes = db.get_votes(id)?;
            for vote in votes {
                self.voting.load_vote(vote);
            }

            self.proposals.insert(id, proposal);
            self.next_proposal_id = self.next_proposal_id.max(id + 1);
        }

        Ok(())
    }

    fn persist_proposal(&self, p: &Proposal) {
        if let Some(db) = self.db.as_ref() {
            match db.lock() {
                Ok(db) => {
                    if let Err(e) = db.update_proposal_status(p) {
                        warn!("Failed to persist proposal {}: {}", p.id, e);
                    }
                }
                Err(e) => warn!("DAO db lock poisoned: {}", e),
            }
        }
    }

    fn persist_new_proposal(&self, p: &Proposal) {
        if let Some(db) = self.db.as_ref() {
            match db.lock() {
                Ok(db) => {
                    if let Err(e) = db.insert_proposal(p) {
                        warn!("Failed to insert proposal {}: {}", p.id, e);
                    }
                }
                Err(e) => warn!("DAO db lock poisoned: {}", e),
            }
        }
    }

    fn persist_vote(&self, proposal_id: u64, vote: &Vote) {
        if let Some(db) = self.db.as_ref() {
            match db.lock() {
                Ok(db) => {
                    if let Err(e) = db.record_vote(
                        proposal_id,
                        &vote.voter,
                        vote.choice.clone(),
                        vote.weight,
                        vote.tx_hash.as_deref(),
                    ) {
                        warn!("Failed to persist vote for proposal {}: {}", proposal_id, e);
                    }
                }
                Err(e) => warn!("DAO db lock poisoned: {}", e),
            }
        }
    }

    /// Get the circulating supply used for quorum calculations.
    pub fn circulating_supply(&self) -> u64 {
        self.circulating_supply
    }

    /// Set the circulating supply (e.g. updated by L1 scanner).
    pub fn set_circulating_supply(&mut self, supply: u64) {
        self.circulating_supply = supply;
    }

    /// Get a proposal by ID.
    pub fn get_proposal(&self, id: u64) -> Option<&Proposal> {
        self.proposals.get(&id)
    }

    /// Get all proposals.
    pub fn all_proposals(&self) -> Vec<&Proposal> {
        self.proposals.values().collect()
    }

    /// Get active proposals (voting still open).
    pub fn active_proposals(&self) -> Vec<&Proposal> {
        self.proposals
            .values()
            .filter(|p| p.is_voting_open())
            .collect()
    }

    /// Create a new proposal.
    ///
    /// The proposer must have at least `PROPOSAL_THRESHOLD` balance.
    pub fn create_proposal(
        &mut self,
        title: String,
        description: String,
        proposal_type: ProposalType,
        proposer: String,
        proposer_balance: u64,
        snapshot_block: u64,
    ) -> DaoResult<u64> {
        if proposer_balance < PROPOSAL_THRESHOLD {
            return Err(DaoError::InsufficientProposalBalance {
                needed: PROPOSAL_THRESHOLD,
                have: proposer_balance,
            });
        }

        let id = self.next_proposal_id;
        self.next_proposal_id += 1;

        let proposal = Proposal::new(
            id,
            title,
            description,
            proposal_type,
            proposer,
            proposer_balance,
            snapshot_block,
        );

        self.persist_new_proposal(&proposal);
        self.proposals.insert(id, proposal);

        if let Some(metrics) = self.metrics.as_ref() {
            metrics
                .proposals_created
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }

        Ok(id)
    }

    /// Cast a vote on a proposal.
    pub fn cast_vote(
        &mut self,
        proposal_id: u64,
        voter: String,
        choice: VoteChoice,
        weight: u64,
        tx_hash: Option<String>,
    ) -> DaoResult<Vote> {
        let vote = {
            let proposal = self
                .proposals
                .get_mut(&proposal_id)
                .ok_or_else(|| DaoError::ProposalNotFound(proposal_id.to_string()))?;

            self.voting
                .cast_vote(proposal, voter, choice, weight, tx_hash)?
        };

        if let Some(proposal) = self.proposals.get(&proposal_id) {
            self.persist_vote(proposal_id, &vote);
            self.persist_proposal(proposal);
        }

        if let Some(metrics) = self.metrics.as_ref() {
            metrics
                .votes_cast
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            match vote.choice {
                VoteChoice::Yes => metrics
                    .votes_yes
                    .fetch_add(vote.weight, std::sync::atomic::Ordering::Relaxed),
                VoteChoice::No => metrics
                    .votes_no
                    .fetch_add(vote.weight, std::sync::atomic::Ordering::Relaxed),
                VoteChoice::Abstain => metrics
                    .votes_abstain
                    .fetch_add(vote.weight, std::sync::atomic::Ordering::Relaxed),
                VoteChoice::Candidate(_) => metrics
                    .votes_yes
                    .fetch_add(vote.weight, std::sync::atomic::Ordering::Relaxed),
            };
        }

        Ok(vote)
    }

    /// Tally votes and check quorum for a proposal whose voting period has ended.
    ///
    /// If quorum is met and the proposal passed, it enters the timelock phase.
    /// If quorum is not met or the proposal failed, it is marked as Failed.
    pub fn tally_proposal(&mut self, proposal_id: u64) -> DaoResult<ProposalStatus> {
        let status = {
            let proposal = self
                .proposals
                .get_mut(&proposal_id)
                .ok_or_else(|| DaoError::ProposalNotFound(proposal_id.to_string()))?;

            if proposal.status != ProposalStatus::Active {
                return Err(DaoError::ProposalNotVotable(proposal_id.to_string()));
            }

            if proposal.is_voting_open() {
                return Err(DaoError::VotingPeriodNotEnded(proposal_id.to_string()));
            }

            // Check quorum
            let quorum_result = check_quorum(proposal, self.circulating_supply);
            let passed = proposal.has_passed();

            match quorum_result {
                Ok(_) => {
                    if passed {
                        proposal.status = ProposalStatus::Passed;
                        // Start timelock
                        let timelock = Timelock::new(proposal_id);
                        proposal.timelock_ends_at = Some(timelock.ends_at);
                        self.timelocks.insert(proposal_id, timelock);
                    } else {
                        proposal.status = ProposalStatus::Failed;
                    }
                }
                Err(_) => {
                    proposal.status = ProposalStatus::Failed;
                }
            }

            proposal.status
        };

        if let Some(proposal) = self.proposals.get(&proposal_id) {
            self.persist_proposal(proposal);
        }
        Ok(status)
    }

    /// Execute a proposal that has passed its timelock.
    ///
    /// Returns a human-readable execution result.
    pub fn execute_proposal(&mut self, proposal_id: u64) -> DaoResult<String> {
        let summary = {
            // Check timelock
            let timelock = self
                .timelocks
                .get_mut(&proposal_id)
                .ok_or_else(|| DaoError::Internal("proposal not in timelock phase".into()))?;

            if timelock.is_active() {
                return Err(DaoError::TimelockActive {
                    remaining_hours: timelock.remaining_hours(),
                });
            }

            if timelock.executed {
                return Err(DaoError::Internal("proposal already executed".into()));
            }

            // Mark timelock executed
            timelock.mark_executed()?;

            // Update proposal status
            let proposal = self
                .proposals
                .get_mut(&proposal_id)
                .ok_or_else(|| DaoError::ProposalNotFound(proposal_id.to_string()))?;

            proposal.status = ProposalStatus::Executed;
            proposal.executed_at = Some(Utc::now());

            // Generate execution summary
            match &proposal.proposal_type {
                ProposalType::Parameter {
                    parameter_name,
                    proposed_value,
                    ..
                } => {
                    format!("Parameter '{}' set to '{}'", parameter_name, proposed_value)
                }
                ProposalType::Treasury {
                    recipient,
                    amount,
                    purpose,
                } => {
                    format!(
                        "Treasury: {} flowers to {} for '{}'",
                        amount, recipient, purpose
                    )
                }
                ProposalType::Emergency { action, .. } => {
                    format!("Emergency action: {}", action)
                }
                ProposalType::Grant {
                    recipient, amount, ..
                } => {
                    format!("Grant: {} flowers to {}", amount, recipient)
                }
                ProposalType::Humanitarian {
                    category,
                    amount,
                    region,
                    ..
                } => {
                    format!(
                        "Humanitarian: {} flowers for {} in {}",
                        amount, category, region
                    )
                }
                ProposalType::Admission { candidate_id, .. } => {
                    format!("Admission: {}", candidate_id)
                }
                ProposalType::Bodhisattva { candidate_id, .. } => {
                    format!("Bodhisattva vow: {}", candidate_id)
                }
                ProposalType::Expulsion { accused_id, .. } => {
                    format!("Expulsion: {}", accused_id)
                }
                ProposalType::CrossLayer { description, .. } => {
                    format!("Cross-layer: {}", description)
                }
                ProposalType::ParliamentaryElection { title, .. } => {
                    let seats = proposal.allocate_seats();
                    let seat_str: Vec<String> =
                        seats.iter().map(|(p, s)| format!("{}: {}", p, s)).collect();
                    format!("Election '{}': {}", title, seat_str.join(", "))
                }
            }
        };

        if let Some(proposal) = self.proposals.get(&proposal_id) {
            self.persist_proposal(proposal);
        }
        if let Some(metrics) = self.metrics.as_ref() {
            metrics
                .proposals_executed
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }

        Ok(summary)
    }

    /// Cancel a proposal (only by proposer or guardian).
    pub fn cancel_proposal(&mut self, proposal_id: u64, caller: &str) -> DaoResult<()> {
        {
            let proposal = self
                .proposals
                .get_mut(&proposal_id)
                .ok_or_else(|| DaoError::ProposalNotFound(proposal_id.to_string()))?;

            if proposal.status != ProposalStatus::Active
                && proposal.status != ProposalStatus::Passed
            {
                return Err(DaoError::ProposalNotVotable(proposal_id.to_string()));
            }

            // Only proposer or a guardian can cancel
            let is_proposer = proposal.proposer == caller;
            let is_guardian = self.config.guardians.iter().any(|g| g.address == caller);

            if !is_proposer && !is_guardian {
                return Err(DaoError::Unauthorized(
                    "only proposer or guardian can cancel".into(),
                ));
            }

            proposal.status = ProposalStatus::Cancelled;
        }

        if let Some(proposal) = self.proposals.get(&proposal_id) {
            self.persist_proposal(proposal);
        }
        Ok(())
    }

    /// Get votes for a proposal.
    pub fn get_votes(&self, proposal_id: u64) -> Vec<&Vote> {
        self.voting.get_votes(proposal_id)
    }

    /// Check if a voter has voted on a proposal.
    pub fn has_voted(&self, proposal_id: u64, voter: &str) -> bool {
        self.voting.has_voted(proposal_id, voter)
    }

    /// Get the timelock for a proposal.
    pub fn get_timelock(&self, proposal_id: u64) -> Option<&Timelock> {
        self.timelocks.get(&proposal_id)
    }

    /// Get the config.
    pub fn config(&self) -> &DaoConfig {
        &self.config
    }

    /// Get a mutable reference to the config.
    pub fn config_mut(&mut self) -> &mut DaoConfig {
        &mut self.config
    }

    /// Process expired proposals (voting period ended but not yet tallied).
    ///
    /// Returns the number of proposals tallied.
    pub fn process_expired(&mut self) -> usize {
        let expired_ids: Vec<u64> = self
            .proposals
            .iter()
            .filter(|(_, p)| p.status == ProposalStatus::Active && !p.is_voting_open())
            .map(|(id, _)| *id)
            .collect();

        let count = expired_ids.len();
        for id in expired_ids {
            let _ = self.tally_proposal(id);
        }
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FLOWERS_PER_ZION;

    fn make_runtime() -> GovernanceRuntime {
        let config = DaoConfig::default();
        let supply = 1_000_000_000 * FLOWERS_PER_ZION; // 1B ZION
        GovernanceRuntime::new(config, supply)
    }

    fn make_parameter_proposal(rt: &mut GovernanceRuntime) -> u64 {
        rt.create_proposal(
            "Test".into(),
            "Desc".into(),
            ProposalType::Parameter {
                parameter_name: "fee".into(),
                current_value: "0.1".into(),
                proposed_value: "0.05".into(),
            },
            "zion1proposer".into(),
            2_000_000 * FLOWERS_PER_ZION, // 2M ZION — above threshold
            100,
        )
        .unwrap()
    }

    #[test]
    fn test_create_proposal_success() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);
        assert_eq!(id, 1);
        assert!(rt.get_proposal(id).is_some());
    }

    #[test]
    fn test_create_proposal_insufficient_balance() {
        let mut rt = make_runtime();
        let result = rt.create_proposal(
            "Test".into(),
            "Desc".into(),
            ProposalType::Parameter {
                parameter_name: "fee".into(),
                current_value: "1".into(),
                proposed_value: "2".into(),
            },
            "zion1poor".into(),
            100, // way below threshold
            100,
        );
        assert!(result.is_err());
        assert!(matches!(
            result,
            Err(DaoError::InsufficientProposalBalance { .. })
        ));
    }

    #[test]
    fn test_vote_and_tally_pass() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        // Cast enough votes to meet quorum (10% of 1B = 100M ZION)
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            150_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();
        rt.cast_vote(
            id,
            "zion1voter2".into(),
            VoteChoice::No,
            50_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();

        // Manually expire the voting period
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }

        let status = rt.tally_proposal(id).unwrap();
        assert_eq!(status, ProposalStatus::Passed);
        assert!(rt.get_timelock(id).is_some());
    }

    #[test]
    fn test_vote_and_tally_fail_quorum() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        // Not enough votes for quorum
        rt.cast_vote(id, "zion1voter1".into(), VoteChoice::Yes, 1_000_000, None)
            .unwrap();

        // Expire
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }

        let status = rt.tally_proposal(id).unwrap();
        assert_eq!(status, ProposalStatus::Failed);
    }

    #[test]
    fn test_vote_and_tally_fail_majority() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        // Quorum met but majority votes No
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::No,
            150_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();
        rt.cast_vote(
            id,
            "zion1voter2".into(),
            VoteChoice::Yes,
            50_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();

        // Expire
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }

        let status = rt.tally_proposal(id).unwrap();
        assert_eq!(status, ProposalStatus::Failed);
    }

    #[test]
    fn test_cancel_proposal_by_proposer() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        rt.cancel_proposal(id, "zion1proposer").unwrap();
        assert_eq!(
            rt.get_proposal(id).unwrap().status,
            ProposalStatus::Cancelled
        );
    }

    #[test]
    fn test_cancel_proposal_unauthorized() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        let result = rt.cancel_proposal(id, "zion1random");
        assert!(result.is_err());
        assert!(matches!(result, Err(DaoError::Unauthorized(_))));
    }

    #[test]
    fn test_process_expired() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        // Add votes
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            150_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();

        // Expire
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }

        let count = rt.process_expired();
        assert_eq!(count, 1);
        assert_eq!(rt.get_proposal(id).unwrap().status, ProposalStatus::Passed);
    }

    #[test]
    fn test_execute_after_timelock() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        // Vote and pass
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            150_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();

        // Expire and tally
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.tally_proposal(id).unwrap();

        // Expire timelock
        {
            let t = rt.timelocks.get_mut(&id).unwrap();
            t.ends_at = Utc::now() - chrono::Duration::seconds(1);
        }

        let result = rt.execute_proposal(id).unwrap();
        assert!(result.contains("Parameter"));
        assert_eq!(
            rt.get_proposal(id).unwrap().status,
            ProposalStatus::Executed
        );
    }

    #[test]
    fn test_execute_timelock_active() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        // Vote and pass
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            150_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();

        // Expire and tally
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.tally_proposal(id).unwrap();

        // Timelock still active
        let result = rt.execute_proposal(id);
        assert!(result.is_err());
        assert!(matches!(result, Err(DaoError::TimelockActive { .. })));
    }

    #[test]
    fn test_double_vote_rejected() {
        let mut rt = make_runtime();
        let id = make_parameter_proposal(&mut rt);

        rt.cast_vote(id, "zion1voter1".into(), VoteChoice::Yes, 100, None)
            .unwrap();

        let result = rt.cast_vote(id, "zion1voter1".into(), VoteChoice::No, 100, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_active_proposals_filter() {
        let mut rt = make_runtime();
        let id1 = make_parameter_proposal(&mut rt);
        let id2 = make_parameter_proposal(&mut rt);

        assert_eq!(rt.active_proposals().len(), 2);

        // Cancel one
        rt.cancel_proposal(id1, "zion1proposer").unwrap();
        assert_eq!(rt.active_proposals().len(), 1);

        // The remaining active one should be id2
        let active: Vec<u64> = rt.active_proposals().iter().map(|p| p.id).collect();
        assert_eq!(active, vec![id2]);
    }

    #[test]
    fn test_parliamentary_election_execution() {
        let mut rt = make_runtime();

        let id = rt
            .create_proposal(
                "Election 2026".into(),
                "Parliamentary election".into(),
                ProposalType::ParliamentaryElection {
                    title: "General Election".into(),
                    parties: vec!["Party A".into(), "Party B".into(), "Party C".into()],
                    seats: 5,
                },
                "zion1proposer".into(),
                2_000_000 * FLOWERS_PER_ZION,
                100,
            )
            .unwrap();

        // Vote for parties
        rt.cast_vote(
            id,
            "zion1v1".into(),
            VoteChoice::Candidate("Party A".into()),
            100_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();
        rt.cast_vote(
            id,
            "zion1v2".into(),
            VoteChoice::Candidate("Party B".into()),
            50_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();
        rt.cast_vote(
            id,
            "zion1v3".into(),
            VoteChoice::Candidate("Party C".into()),
            30_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();

        // Expire and tally
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.tally_proposal(id).unwrap();

        // Expire timelock
        {
            let t = rt.timelocks.get_mut(&id).unwrap();
            t.ends_at = Utc::now() - chrono::Duration::seconds(1);
        }

        let result = rt.execute_proposal(id).unwrap();
        assert!(result.contains("Election"));
        assert!(result.contains("Party A"));
    }
}
