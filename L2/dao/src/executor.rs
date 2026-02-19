//! Executor — executes passed + timelocked proposals on L1.
//!
//! The executor is the final step in the governance lifecycle:
//! Proposal → Voting → Passed → Timelock → **Execute**
//!
//! Execution means creating an L1 transaction that fulfills the proposal.

use crate::error::{DaoError, DaoResult};
use crate::proposal::{Proposal, ProposalStatus, ProposalType};
use crate::timelock::Timelock;
use crate::treasury::{Treasury, TreasuryOperation};

/// Execute a passed and timelocked proposal
pub fn execute_proposal(
    proposal: &mut Proposal,
    timelock: &mut Timelock,
    treasury: &mut Treasury,
) -> DaoResult<String> {
    // Verify status
    if proposal.status != ProposalStatus::Timelocked {
        return Err(DaoError::ProposalNotVotable(format!(
            "Proposal {} is {:?}, expected Timelocked",
            proposal.id, proposal.status
        )));
    }

    // Verify timelock is ready
    if timelock.is_active() {
        return Err(DaoError::TimelockActive {
            remaining_hours: timelock.remaining_hours(),
        });
    }

    // Execute based on proposal type
    let result = match &proposal.proposal_type {
        ProposalType::Treasury {
            recipient,
            amount,
            purpose,
            ..
        } => {
            // Create treasury spend operation
            let op_id = format!("dao-exec-{}", proposal.id);
            treasury.submit_operation(
                op_id.clone(),
                TreasuryOperation::Spend {
                    recipient: recipient.clone(),
                    amount: *amount,
                    purpose: purpose.clone(),
                    proposal_id: proposal.id,
                },
                // TODO: In production, this needs guardian multi-sig
                "zion1executor",
            )?;
            format!("Treasury spend submitted: {} → {}", amount, recipient)
        }
        ProposalType::Humanitarian {
            category,
            amount,
            region,
            ..
        } => {
            let op_id = format!("dao-humanitarian-{}", proposal.id);
            treasury.submit_operation(
                op_id.clone(),
                TreasuryOperation::HumanitarianGrant {
                    category: category.clone(),
                    recipient: region.clone(),
                    amount: *amount,
                    proposal_id: proposal.id,
                },
                "zion1executor",
            )?;
            format!(
                "Humanitarian grant submitted: {} ZION to {}",
                amount, category
            )
        }
        ProposalType::Parameter {
            parameter_name,
            proposed_value,
            ..
        } => {
            // TODO: Emit L1 transaction with parameter change
            format!("Parameter {} changed to {}", parameter_name, proposed_value)
        }
        ProposalType::Grant {
            recipient, amount, ..
        } => {
            let op_id = format!("dao-grant-{}", proposal.id);
            treasury.submit_operation(
                op_id,
                TreasuryOperation::Spend {
                    recipient: recipient.clone(),
                    amount: *amount,
                    purpose: format!("Grant proposal #{}", proposal.id),
                    proposal_id: proposal.id,
                },
                "zion1executor",
            )?;
            format!("Grant submitted: {} → {}", amount, recipient)
        }
        ProposalType::Emergency { action, .. } => {
            // TODO: Execute emergency action (pause bridge, etc.)
            format!("Emergency action executed: {}", action)
        }
    };

    // Update status
    proposal.status = ProposalStatus::Executed;
    proposal.executed_at = Some(chrono::Utc::now());
    timelock.mark_executed()?;

    Ok(result)
}
