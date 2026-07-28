use crate::warp::error::{WarpError, WarpResult};
use crate::warp::types::WarpStatus;

/// State machine for a cross-chain transfer lifecycle.
///
/// Valid transitions:
/// ```text
/// Pending → Detected → AwaitingFinality → Validating → QuorumReached → Executing → Completed
///                                                                                 → Failed
/// Pending → TimelockHold → Detected (after 24h)
/// Any non-terminal → Failed
/// ```
#[derive(Debug, Clone)]
pub struct TransferStateMachine {
    current: WarpStatus,
    history: Vec<(WarpStatus, u64)>,
}

impl TransferStateMachine {
    pub fn new(initial: WarpStatus) -> Self {
        let now = chrono::Utc::now().timestamp() as u64;
        Self {
            current: initial,
            history: vec![(initial, now)],
        }
    }

    pub fn current(&self) -> WarpStatus {
        self.current
    }

    pub fn transition(&mut self, next: WarpStatus) -> WarpResult<()> {
        if !Self::is_valid_transition(self.current, next) {
            return Err(WarpError::InvalidStateTransition {
                from: self.current.to_string(),
                to: next.to_string(),
            });
        }
        let now = chrono::Utc::now().timestamp() as u64;
        self.current = next;
        self.history.push((next, now));
        Ok(())
    }

    fn is_valid_transition(from: WarpStatus, to: WarpStatus) -> bool {
        use WarpStatus::*;
        matches!(
            (from, to),
            // Happy path
            (Pending, Detected)
            | (Detected, AwaitingFinality)
            | (AwaitingFinality, Validating)
            | (Validating, QuorumReached)
            | (QuorumReached, Executing)
            | (Executing, Completed)
            // Timelock path
            | (Pending, TimelockHold)
            | (TimelockHold, Detected)
            // Failure from any non-terminal state
            | (Pending, Failed)
            | (Detected, Failed)
            | (AwaitingFinality, Failed)
            | (Validating, Failed)
            | (QuorumReached, Failed)
            | (Executing, Failed)
            | (TimelockHold, Failed)
        )
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self.current, WarpStatus::Completed | WarpStatus::Failed)
    }

    pub fn history(&self) -> &[(WarpStatus, u64)] {
        &self.history
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_happy_path() {
        let mut sm = TransferStateMachine::new(WarpStatus::Pending);
        sm.transition(WarpStatus::Detected).unwrap();
        sm.transition(WarpStatus::AwaitingFinality).unwrap();
        sm.transition(WarpStatus::Validating).unwrap();
        sm.transition(WarpStatus::QuorumReached).unwrap();
        sm.transition(WarpStatus::Executing).unwrap();
        sm.transition(WarpStatus::Completed).unwrap();
        assert!(sm.is_terminal());
        assert_eq!(sm.history().len(), 7);
    }

    #[test]
    fn test_timelock_path() {
        let mut sm = TransferStateMachine::new(WarpStatus::Pending);
        sm.transition(WarpStatus::TimelockHold).unwrap();
        sm.transition(WarpStatus::Detected).unwrap();
        sm.transition(WarpStatus::AwaitingFinality).unwrap();
        assert_eq!(sm.current(), WarpStatus::AwaitingFinality);
    }

    #[test]
    fn test_failure_from_any_state() {
        for start in [
            WarpStatus::Pending,
            WarpStatus::Detected,
            WarpStatus::AwaitingFinality,
            WarpStatus::Validating,
            WarpStatus::QuorumReached,
            WarpStatus::Executing,
            WarpStatus::TimelockHold,
        ] {
            let mut sm = TransferStateMachine::new(start);
            sm.transition(WarpStatus::Failed).unwrap();
            assert!(sm.is_terminal());
        }
    }

    #[test]
    fn test_invalid_transition_completed_to_anything() {
        let mut sm = TransferStateMachine::new(WarpStatus::Pending);
        sm.transition(WarpStatus::Detected).unwrap();
        sm.transition(WarpStatus::AwaitingFinality).unwrap();
        sm.transition(WarpStatus::Validating).unwrap();
        sm.transition(WarpStatus::QuorumReached).unwrap();
        sm.transition(WarpStatus::Executing).unwrap();
        sm.transition(WarpStatus::Completed).unwrap();
        // Terminal state — cannot transition further
        assert!(sm.transition(WarpStatus::Pending).is_err());
        assert!(sm.transition(WarpStatus::Failed).is_err());
    }

    #[test]
    fn test_invalid_skip() {
        let mut sm = TransferStateMachine::new(WarpStatus::Pending);
        // Cannot skip Detected
        assert!(sm.transition(WarpStatus::AwaitingFinality).is_err());
    }

    #[test]
    fn test_invalid_backward() {
        let mut sm = TransferStateMachine::new(WarpStatus::Pending);
        sm.transition(WarpStatus::Detected).unwrap();
        sm.transition(WarpStatus::AwaitingFinality).unwrap();
        // Cannot go back
        assert!(sm.transition(WarpStatus::Detected).is_err());
    }

    #[test]
    fn test_initial_not_terminal() {
        let sm = TransferStateMachine::new(WarpStatus::Pending);
        assert!(!sm.is_terminal());
    }

    #[test]
    fn test_history_tracks_states() {
        let mut sm = TransferStateMachine::new(WarpStatus::Pending);
        sm.transition(WarpStatus::Detected).unwrap();
        sm.transition(WarpStatus::AwaitingFinality).unwrap();
        assert_eq!(sm.history().len(), 3);
        assert_eq!(sm.history()[0].0, WarpStatus::Pending);
        assert_eq!(sm.history()[1].0, WarpStatus::Detected);
        assert_eq!(sm.history()[2].0, WarpStatus::AwaitingFinality);
    }
}
