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
use crate::quorum::check_quorum_with_floor;
use crate::timelock::Timelock;
use crate::types::VoteChoice;
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

    /// Attach a SQLite DAO database for persistence and replay any
    /// governance parameters applied by executed Parameter proposals (D5),
    /// so an approved change survives a daemon restart. Replay is
    /// best-effort: an unparseable stored value is logged and skipped, the
    /// config-file value stays in effect.
    pub fn with_db(mut self, db: Arc<Mutex<DaoDb>>) -> Self {
        if let Ok(guard) = db.lock() {
            match guard.gov_params() {
                Ok(params) => {
                    for (name, value) in params {
                        if let Err(e) = self.apply_config_param(&name, &value) {
                            warn!("[DAO] replaying param {name}={value} failed: {e}");
                        }
                    }
                }
                Err(e) => warn!("[DAO] dao_params replay failed: {e}"),
            }
            // D3: replay guardian registry mutations (admissions add,
            // expulsions remove — tombstones override config-file guardians).
            match guard.gov_guardians() {
                Ok(muts) => {
                    for (address, pubkey, active) in muts {
                        if active {
                            if !self.config.guardians.iter().any(|g| g.address == address) {
                                self.config.guardians.push(crate::config::GuardianConfig {
                                    name: address.clone(),
                                    address,
                                    public_key: pubkey,
                                });
                            }
                        } else {
                            self.config.guardians.retain(|g| g.address != address);
                        }
                    }
                }
                Err(e) => warn!("[DAO] dao_guardians replay failed: {e}"),
            }
        }
        self.db = Some(db);
        self
    }

    /// Attach shared metrics counters.
    pub fn with_metrics(mut self, metrics: Arc<DaoMetrics>) -> Self {
        self.metrics = Some(metrics);
        self
    }

    /// Access the attached SQLite database, if any.
    pub fn db(&self) -> Option<Arc<Mutex<DaoDb>>> {
        self.db.clone()
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

    /// Append an immutable audit event (D4). Never fatal — a log failure
    /// must not abort the governance transition being recorded.
    fn emit_event(&self, subject: &str, event_type: &str, actor: Option<&str>, data: serde_json::Value) {
        if let Some(db) = self.db.as_ref() {
            let data_json = serde_json::to_string(&data).unwrap_or_else(|_| "{}".into());
            match db.lock() {
                Ok(db) => {
                    if let Err(e) = db.insert_event(subject, event_type, actor, &data_json) {
                        warn!("Failed to emit event {} on {}: {}", event_type, subject, e);
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

    /// Runtime-governable parameter names — the whitelist a `Parameter`
    /// proposal may change without redeploy (D5). Config keys that could
    /// hijack or brick the daemon (api_key, db_path, rpc urls, guardians,
    /// treasury addresses, zis auth) are deliberately excluded.
    pub fn governable_parameters() -> &'static [&'static str] {
        &[
            "min_vote_weight",
            "proposal_threshold",
            "quorum_percent",
            "voting_period_days",
            "timelock_hours",
            "daily_spend_limit",
            "multisig_threshold",
            "cross_layer_consent_threshold",
        ]
    }

    /// Parse + static-bound check used at proposal creation. Dynamic bounds
    /// (e.g. `multisig_threshold` ≤ `multisig_total`) are re-checked in
    /// `apply_config_param` at execution, since the config may have moved.
    fn validate_governance_param(name: &str, value: &str) -> DaoResult<()> {
        let bad = || {
            DaoError::Config(format!("invalid value '{value}' for parameter '{name}'"))
        };
        match name {
            "min_vote_weight" | "proposal_threshold" => {
                if value.trim().parse::<u64>().map_err(|_| bad())? == 0 {
                    return Err(bad());
                }
            }
            "daily_spend_limit" => {
                value.trim().parse::<u64>().map_err(|_| bad())?;
            }
            "quorum_percent" => {
                let v: f64 = value.trim().parse().map_err(|_| bad())?;
                if !(v > 0.0 && v <= 100.0) {
                    return Err(bad());
                }
            }
            "voting_period_days" => {
                let v: u32 = value.trim().parse().map_err(|_| bad())?;
                if !(1..=365).contains(&v) {
                    return Err(bad());
                }
            }
            "timelock_hours" => {
                let v: u32 = value.trim().parse().map_err(|_| bad())?;
                if !(1..=8760).contains(&v) {
                    return Err(bad());
                }
            }
            "multisig_threshold" => {
                if value.trim().parse::<u32>().map_err(|_| bad())? == 0 {
                    return Err(bad());
                }
            }
            "cross_layer_consent_threshold" => {
                let v: u8 = value.trim().parse().map_err(|_| bad())?;
                if !(1..=4).contains(&v) {
                    return Err(bad());
                }
            }
            _ => {
                return Err(DaoError::Config(format!(
                    "parameter '{name}' is not governable (allowed: {})",
                    Self::governable_parameters().join(", ")
                )));
            }
        }
        Ok(())
    }

    /// Apply a governable parameter to the live config. Re-validates static
    /// bounds and enforces dynamic ones. Called by `execute_proposal` for
    /// `Parameter` proposals and by `with_db` when replaying `dao_params`.
    pub fn apply_config_param(&mut self, name: &str, value: &str) -> DaoResult<()> {
        Self::validate_governance_param(name, value)?;
        let v = value.trim();
        match name {
            "min_vote_weight" => self.config.min_vote_weight = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "proposal_threshold" => self.config.proposal_threshold = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "daily_spend_limit" => self.config.daily_spend_limit = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "quorum_percent" => self.config.quorum_percent = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "voting_period_days" => self.config.voting_period_days = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "timelock_hours" => self.config.timelock_hours = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "cross_layer_consent_threshold" => self.config.cross_layer_consent_threshold = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?,
            "multisig_threshold" => {
                let t: u32 = v.parse().map_err(|_| DaoError::Internal("param parse".into()))?;
                if t > self.config.multisig_total {
                    return Err(DaoError::Config(format!(
                        "multisig_threshold {t} exceeds multisig_total {}",
                        self.config.multisig_total
                    )));
                }
                self.config.multisig_threshold = t;
            }
            _ => unreachable!("validated whitelist"),
        }
        Ok(())
    }

    /// Execute-path application: mutate config, persist to `dao_params` for
    /// startup replay. Runs before the executed flag flips so a failure
    /// leaves the proposal inspectable rather than stuck. Parameters outside
    /// the whitelist (only possible for proposals created before D5
    /// validation) are recorded in the summary but never applied.
    fn apply_executed_parameter(
        &mut self,
        proposal_id: u64,
        name: &str,
        value: &str,
    ) -> DaoResult<()> {
        if !Self::governable_parameters().contains(&name) {
            return Ok(());
        }
        self.apply_config_param(name, value)?;
        if let Some(db) = self.db.as_ref() {
            if let Ok(guard) = db.lock() {
                if let Err(e) = guard.set_gov_param(name, value, proposal_id) {
                    warn!("[DAO] param persist failed for proposal {proposal_id}: {e}");
                }
            }
        }
        Ok(())
    }

    /// Execute-path guardian rotation (D3). `admit=true` admits the
    /// L1-registered candidate; `admit=false` expels the address.
    /// Mutations persist to `dao_guardians` and replay in `with_db`.
    fn apply_guardian_mutation(
        &mut self,
        proposal_id: u64,
        address: &str,
        admit: bool,
    ) -> DaoResult<()> {
        if admit {
            let pubkey = match self.db.as_ref().and_then(|db| {
                db.lock()
                    .ok()
                    .and_then(|g| g.guardian_candidate_pubkey(address).ok().flatten())
            }) {
                Some(pk) => pk,
                None => {
                    return Err(DaoError::Config(format!(
                        "guardian candidate {address} has not registered a pubkey on L1 \
                         (memo DAO:guardian:register:<pubkey>)"
                    )))
                }
            };
            if !self.config.guardians.iter().any(|g| g.address == address) {
                self.config.guardians.push(crate::config::GuardianConfig {
                    name: address.to_string(),
                    address: address.to_string(),
                    public_key: pubkey.clone(),
                });
            }
            if let Some(db) = self.db.as_ref() {
                if let Ok(guard) = db.lock() {
                    if let Err(e) = guard.set_gov_guardian(address, &pubkey, true, proposal_id) {
                        warn!("[DAO] guardian persist failed for proposal {proposal_id}: {e}");
                    }
                }
            }
            self.emit_event(
                &format!("proposal:{proposal_id}"),
                "guardian_admitted",
                None,
                serde_json::json!({ "address": address }),
            );
        } else {
            let pubkey = self
                .config
                .guardians
                .iter()
                .find(|g| g.address == address)
                .map(|g| g.public_key.clone())
                .unwrap_or_default();
            self.config.guardians.retain(|g| g.address != address);
            if let Some(db) = self.db.as_ref() {
                if let Ok(guard) = db.lock() {
                    if let Err(e) = guard.set_gov_guardian(address, &pubkey, false, proposal_id) {
                        warn!("[DAO] guardian tombstone persist failed: {e}");
                    }
                }
            }
            self.emit_event(
                &format!("proposal:{proposal_id}"),
                "guardian_expelled",
                None,
                serde_json::json!({ "address": address }),
            );
        }
        Ok(())
    }

    /// Create a new proposal.
    ///
    /// The proposer must have at least `config.proposal_threshold` balance.
    pub fn create_proposal(
        &mut self,
        title: String,
        description: String,
        proposal_type: ProposalType,
        proposer: String,
        proposer_balance: u64,
        snapshot_block: u64,
    ) -> DaoResult<u64> {
        let threshold = self.config.proposal_threshold;
        if proposer_balance < threshold {
            return Err(DaoError::InsufficientProposalBalance {
                needed: threshold,
                have: proposer_balance,
            });
        }

        // D5: a Parameter proposal must name a governable parameter with a
        // value that parses and passes static bounds — otherwise it could
        // pass the vote yet be impossible to execute.
        if let ProposalType::Parameter {
            parameter_name,
            proposed_value,
            ..
        } = &proposal_type
        {
            Self::validate_governance_param(parameter_name, proposed_value)?;
        }

        let id = self.next_proposal_id;
        self.next_proposal_id += 1;

        let standard_period_secs = self.config.voting_period_days as u64 * 24 * 60 * 60;
        let period_secs = proposal_type.voting_period_secs_or(standard_period_secs);
        let proposal = Proposal::new(
            id,
            title,
            description,
            proposal_type,
            proposer,
            proposer_balance,
            snapshot_block,
        )
        .with_voting_period(period_secs);

        self.persist_new_proposal(&proposal);
        self.emit_event(
            &format!("proposal:{id}"),
            "proposal_created",
            Some(&proposal.proposer),
            serde_json::json!({
                "title": proposal.title,
                "proposal_type": proposal.proposal_type.type_name(),
                "snapshot_block": proposal.snapshot_block,
                "voting_ends_at": proposal.voting_ends_at.to_rfc3339(),
            }),
        );
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
        self.emit_event(
            &format!("proposal:{proposal_id}"),
            "vote_cast",
            Some(&vote.voter),
            serde_json::json!({
                "choice": format!("{:?}", vote.choice),
                "weight": vote.weight,
                "tx_hash": vote.tx_hash,
            }),
        );

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

            // Check quorum (per-type floor vs configured base quorum)
            let quorum_result = check_quorum_with_floor(
                proposal,
                self.circulating_supply,
                self.config.quorum_percent,
            );
            let passed = proposal.has_passed();

            match quorum_result {
                Ok(_) => {
                    if passed {
                        proposal.status = ProposalStatus::Passed;
                        // Start timelock
                        let timelock =
                            Timelock::new_with_hours(proposal_id, self.config.timelock_hours);
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
        self.emit_event(
            &format!("proposal:{proposal_id}"),
            "proposal_tallied",
            None,
            serde_json::json!({
                "new_status": format!("{:?}", status),
                "total_votes": self.proposals.get(&proposal_id).map(|p| p.total_votes()),
            }),
        );
        Ok(status)
    }

    /// Execute a proposal that has passed its timelock.
    ///
    /// Returns a human-readable execution result.
    pub fn execute_proposal(&mut self, proposal_id: u64) -> DaoResult<String> {
        // Validate the timelock phase first (read-only), so a premature
        // execute cannot mutate the live config via a Parameter proposal.
        {
            let timelock = self
                .timelocks
                .get(&proposal_id)
                .ok_or_else(|| DaoError::Internal("proposal not in timelock phase".into()))?;
            if timelock.is_active() {
                return Err(DaoError::TimelockActive {
                    remaining_hours: timelock.remaining_hours(),
                });
            }
            if timelock.executed {
                return Err(DaoError::Internal("proposal already executed".into()));
            }
        }

        // D5: apply a Parameter change to the live config BEFORE marking the
        // proposal executed — a failure (e.g. multisig_threshold > total)
        // leaves the proposal executable/inspectable rather than stuck.
        let param_to_apply = match self.proposals.get(&proposal_id) {
            Some(p) => match &p.proposal_type {
                ProposalType::Parameter {
                    parameter_name,
                    proposed_value,
                    ..
                } => Some((parameter_name.clone(), proposed_value.clone())),
                _ => None,
            },
            None => None,
        };
        if let Some((name, value)) = param_to_apply.as_ref() {
            self.apply_executed_parameter(proposal_id, name, value)?;
        }

        // D3: Admission/Expulsion rotate the guardian registry at execution.
        // Admission requires the candidate to be registered on L1 (pubkey
        // proves ownership); Expulsion tombstones the address — including
        // config-file guardians — so the removal replays at startup.
        let guardian_action = match self.proposals.get(&proposal_id) {
            Some(p) => match &p.proposal_type {
                ProposalType::Admission { candidate_id, .. } => {
                    Some((candidate_id.clone(), true))
                }
                ProposalType::Expulsion { accused_id, .. } => {
                    Some((accused_id.clone(), false))
                }
                _ => None,
            },
            None => None,
        };
        if let Some((address, admit)) = guardian_action {
            self.apply_guardian_mutation(proposal_id, &address, admit)?;
        }

        let summary = {
            let timelock = self
                .timelocks
                .get_mut(&proposal_id)
                .ok_or_else(|| DaoError::Internal("proposal not in timelock phase".into()))?;

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
        self.emit_event(
            &format!("proposal:{proposal_id}"),
            "proposal_executed",
            None,
            serde_json::json!({ "summary": summary }),
        );
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
        self.emit_event(
            &format!("proposal:{proposal_id}"),
            "proposal_cancelled",
            Some(caller),
            serde_json::json!({}),
        );
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

    /// Count of distinct voter addresses across all proposals.
    pub fn unique_voters(&self) -> usize {
        self.voting.unique_voters()
    }

    /// Proposals whose voting window closed but that are still `Active`
    /// (waiting for the periodic tally pass).
    pub fn awaiting_tally(&self) -> Vec<&Proposal> {
        self.proposals
            .values()
            .filter(|p| p.status == ProposalStatus::Active && !p.is_voting_open())
            .collect()
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
                parameter_name: "quorum_percent".into(),
                current_value: "10".into(),
                proposed_value: "15".into(),
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
    fn test_event_log_records_lifecycle() {
        use std::sync::Mutex as StdMutex;
        let db = crate::db::DaoDb::in_memory().unwrap();
        let db = std::sync::Arc::new(StdMutex::new(db));
        let mut rt = make_runtime().with_db(std::sync::Arc::clone(&db));
        let id = make_parameter_proposal(&mut rt);
        rt.cast_vote(id, "zion1voter".into(), crate::types::VoteChoice::Yes, 150_000_000_000_000, None)
            .unwrap();
        rt.cancel_proposal(id, "zion1proposer").unwrap();

        let events = db
            .lock()
            .unwrap()
            .list_events(&format!("proposal:{id}"), 100)
            .unwrap();
        let types: Vec<&str> = events.iter().map(|e| e.event_type.as_str()).collect();
        assert_eq!(
            types,
            ["proposal_created", "vote_cast", "proposal_cancelled"]
        );
        assert_eq!(events[0].actor.as_deref(), Some("zion1proposer"));
        assert_eq!(events[1].actor.as_deref(), Some("zion1voter"));
        assert_eq!(events[2].actor.as_deref(), Some("zion1proposer"));
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
        // D5: the governable parameter was applied to the live config.
        assert_eq!(rt.config().quorum_percent, 15.0);
    }

    #[test]
    fn test_param_proposal_rejects_ungovernable_and_invalid() {
        let mut rt = make_runtime();
        // Unknown name → rejected at creation.
        let err = rt
            .create_proposal(
                "T".into(),
                "D".into(),
                ProposalType::Parameter {
                    parameter_name: "api_key".into(),
                    current_value: "x".into(),
                    proposed_value: "y".into(),
                },
                "zion1proposer".into(),
                2_000_000 * FLOWERS_PER_ZION,
                100,
            )
            .unwrap_err();
        assert!(err.to_string().contains("not governable"), "{err}");
        // Governable name but out-of-bounds value → rejected.
        assert!(rt
            .create_proposal(
                "T".into(),
                "D".into(),
                ProposalType::Parameter {
                    parameter_name: "quorum_percent".into(),
                    current_value: "10".into(),
                    proposed_value: "250".into(),
                },
                "zion1proposer".into(),
                2_000_000 * FLOWERS_PER_ZION,
                100,
            )
            .is_err());
    }

    #[test]
    fn test_executed_param_persists_and_replays() {
        use std::sync::Mutex as StdMutex;
        let db = crate::db::DaoDb::in_memory().unwrap();
        let db = std::sync::Arc::new(StdMutex::new(db));
        let mut rt = make_runtime().with_db(std::sync::Arc::clone(&db));
        let id = make_parameter_proposal(&mut rt);
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            150_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.tally_proposal(id).unwrap();
        {
            let t = rt.timelocks.get_mut(&id).unwrap();
            t.ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.execute_proposal(id).unwrap();
        assert_eq!(rt.config().quorum_percent, 15.0);
        assert_eq!(
            db.lock().unwrap().gov_params().unwrap(),
            vec![("quorum_percent".to_string(), "15".to_string())]
        );
        // Restart: a fresh runtime on the same DB replays the applied value.
        let rt2 = make_runtime().with_db(std::sync::Arc::clone(&db));
        assert_eq!(rt2.config().quorum_percent, 15.0);
    }

    /// Drive a proposal through vote → tally → timelock-expiry → execute.
    fn pass_and_execute(rt: &mut GovernanceRuntime, id: u64) {
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            900_000_000 * FLOWERS_PER_ZION, // clears every quorum floor
            None,
        )
        .unwrap();
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.tally_proposal(id).unwrap();
        {
            let t = rt.timelocks.get_mut(&id).unwrap();
            t.ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.execute_proposal(id).unwrap();
    }

    #[test]
    fn test_guardian_rotation_via_governance() {
        use std::sync::Mutex as StdMutex;
        let db = crate::db::DaoDb::in_memory().unwrap();
        // Candidate registers a pubkey (as the L1 scanner would after
        // verifying the memo signature binds key → address).
        db.register_guardian_candidate("zion1cand", "aa".repeat(32).as_str(), "txid1")
            .unwrap();
        let db = std::sync::Arc::new(StdMutex::new(db));
        let mut rt = make_runtime().with_db(std::sync::Arc::clone(&db));
        assert!(rt.config().guardians.is_empty());

        // Admission executes → guardian added live + persisted.
        let admit_id = rt
            .create_proposal(
                "Admit".into(),
                "D".into(),
                ProposalType::Admission {
                    candidate_id: "zion1cand".into(),
                    gate_scores_hash: "x".into(),
                    sponsoring_guardians: vec![],
                    community: "core".into(),
                },
                "zion1proposer".into(),
                2_000_000 * FLOWERS_PER_ZION,
                100,
            )
            .unwrap();
        pass_and_execute(&mut rt, admit_id);
        assert_eq!(rt.config().guardians.len(), 1);
        assert_eq!(rt.config().guardians[0].address, "zion1cand");

        // Expulsion executes → guardian removed live + tombstoned.
        let expel_id = rt
            .create_proposal(
                "Expel".into(),
                "D".into(),
                ProposalType::Expulsion {
                    accused_id: "zion1cand".into(),
                    offense_category: "abuse".into(),
                    investigation_hash: "x".into(),
                    defense_hash: None,
                    tier: 1,
                },
                "zion1proposer".into(),
                2_000_000 * FLOWERS_PER_ZION,
                100,
            )
            .unwrap();
        pass_and_execute(&mut rt, expel_id);
        assert!(rt.config().guardians.is_empty());

        // Restart replays: admitted then expelled → stays empty.
        let rt2 = make_runtime().with_db(std::sync::Arc::clone(&db));
        assert!(rt2.config().guardians.is_empty());
    }

    #[test]
    fn test_admission_requires_l1_registration() {
        let mut rt = make_runtime();
        let id = rt
            .create_proposal(
                "Admit".into(),
                "D".into(),
                ProposalType::Admission {
                    candidate_id: "zion1unregistered".into(),
                    gate_scores_hash: "x".into(),
                    sponsoring_guardians: vec![],
                    community: "core".into(),
                },
                "zion1proposer".into(),
                2_000_000 * FLOWERS_PER_ZION,
                100,
            )
            .unwrap();
        rt.cast_vote(
            id,
            "zion1voter1".into(),
            VoteChoice::Yes,
            900_000_000 * FLOWERS_PER_ZION,
            None,
        )
        .unwrap();
        {
            let p = rt.proposals.get_mut(&id).unwrap();
            p.voting_ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        rt.tally_proposal(id).unwrap();
        {
            let t = rt.timelocks.get_mut(&id).unwrap();
            t.ends_at = Utc::now() - chrono::Duration::seconds(1);
        }
        let e = rt.execute_proposal(id).unwrap_err();
        assert!(e.to_string().contains("not registered"), "{e}");
        // Not marked executed — still retryable after registration.
        assert_ne!(
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
