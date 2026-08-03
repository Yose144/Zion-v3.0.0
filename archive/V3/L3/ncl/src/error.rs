use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum NclError {
    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("No available worker for backend: {0}")]
    NoWorkerAvailable(String),

    #[error("Backend not supported: {0}")]
    UnsupportedBackend(String),

    #[error("Job execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Insufficient funds: need {required}, have {available}")]
    InsufficientFunds { required: u64, available: u64 },

    #[error("Queue full: {current}/{max}")]
    QueueFull { current: usize, max: usize },

    #[error("Invalid model: {0}")]
    InvalidModel(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Timeout: job {job_id} exceeded {timeout_ms}ms")]
    Timeout { job_id: String, timeout_ms: u64 },
}

pub type NclResult<T> = Result<T, NclError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let e = NclError::JobNotFound("abc".into());
        assert!(e.to_string().contains("abc"));
    }

    #[test]
    fn test_insufficient_funds() {
        let e = NclError::InsufficientFunds {
            required: 1000,
            available: 500,
        };
        assert!(e.to_string().contains("1000"));
        assert!(e.to_string().contains("500"));
    }

    #[test]
    fn test_queue_full() {
        let e = NclError::QueueFull {
            current: 100,
            max: 100,
        };
        assert!(e.to_string().contains("100/100"));
    }
}
