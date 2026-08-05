use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum AiError {
    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Agent already registered: {0}")]
    AlreadyRegistered(String),

    #[error("Capability not available: {0}")]
    CapabilityNotAvailable(String),

    #[error("Message delivery failed: {0}")]
    MessageFailed(String),

    #[error("Agent offline: {0}")]
    AgentOffline(String),

    #[error("Consciousness level too low: need {required}, have {current}")]
    ConsciousnessInsufficient { required: u8, current: u8 },

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Tool execution failed: {0}")]
    ToolExecutionFailed(String),

    #[error("Human approval required for tool: {0}")]
    ApprovalRequired(String),
}

pub type AiResult<T> = Result<T, AiError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let e = AiError::AgentNotFound("agent-42".into());
        assert!(e.to_string().contains("agent-42"));
    }

    #[test]
    fn test_consciousness_error() {
        let e = AiError::ConsciousnessInsufficient {
            required: 5,
            current: 2,
        };
        assert!(e.to_string().contains("5"));
        assert!(e.to_string().contains("2"));
    }
}
