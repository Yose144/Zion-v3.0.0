use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{NclError, NclResult};
use crate::types::{NclJob, NclJobStatus, NclWorker, ComputeBackend};

/// Job scheduler — assigns queued jobs to available workers.
pub struct JobScheduler {
    jobs: HashMap<Uuid, NclJob>,
    workers: HashMap<String, NclWorker>,
    max_queue_size: usize,
}

impl JobScheduler {
    pub fn new(max_queue_size: usize) -> Self {
        Self {
            jobs: HashMap::new(),
            workers: HashMap::new(),
            max_queue_size,
        }
    }

    /// Submit a new job to the queue.
    pub fn submit_job(&mut self, job: NclJob) -> NclResult<Uuid> {
        let queued = self.jobs.values().filter(|j| j.status == NclJobStatus::Queued).count();
        if queued >= self.max_queue_size {
            return Err(NclError::QueueFull {
                current: queued,
                max: self.max_queue_size,
            });
        }
        let id = job.id;
        self.jobs.insert(id, job);
        Ok(id)
    }

    /// Register a compute worker.
    pub fn register_worker(&mut self, worker: NclWorker) {
        self.workers.insert(worker.id.clone(), worker);
    }

    /// Try to assign the next queued job to an available worker.
    pub fn try_assign_next(&mut self) -> NclResult<Option<(Uuid, String)>> {
        // Find the oldest queued job
        let queued_job_id = self.jobs.values()
            .filter(|j| j.status == NclJobStatus::Queued)
            .min_by_key(|j| j.created_at)
            .map(|j| (j.id, j.backend));

        let (job_id, backend) = match queued_job_id {
            Some((id, b)) => (id, b),
            None => return Ok(None),
        };

        // Find an available worker that supports this backend
        let worker_id = self.workers.values()
            .find(|w| w.has_capacity() && w.supports_backend(backend))
            .map(|w| w.id.clone());

        let worker_id = match worker_id {
            Some(id) => id,
            None => return Err(NclError::NoWorkerAvailable(backend.to_string())),
        };

        // Assign
        if let Some(job) = self.jobs.get_mut(&job_id) {
            job.status = NclJobStatus::Assigned;
            job.worker_id = Some(worker_id.clone());
        }
        if let Some(worker) = self.workers.get_mut(&worker_id) {
            worker.active_jobs += 1;
        }

        Ok(Some((job_id, worker_id)))
    }

    /// Mark a job as completed.
    pub fn complete_job(&mut self, job_id: Uuid, output_hash: String) -> NclResult<()> {
        let job = self.jobs.get_mut(&job_id).ok_or_else(|| {
            NclError::JobNotFound(job_id.to_string())
        })?;
        job.status = NclJobStatus::Completed;
        job.output_hash = Some(output_hash);
        job.completed_at = Some(chrono::Utc::now());

        if let Some(worker_id) = &job.worker_id {
            if let Some(worker) = self.workers.get_mut(worker_id) {
                worker.active_jobs = worker.active_jobs.saturating_sub(1);
                worker.total_completed += 1;
                worker.total_earned += job.reward_atomic;
            }
        }
        Ok(())
    }

    /// Mark a job as failed.
    pub fn fail_job(&mut self, job_id: Uuid, _reason: &str) -> NclResult<()> {
        let job = self.jobs.get_mut(&job_id).ok_or_else(|| {
            NclError::JobNotFound(job_id.to_string())
        })?;
        job.status = NclJobStatus::Failed;

        if let Some(worker_id) = &job.worker_id {
            if let Some(worker) = self.workers.get_mut(worker_id) {
                worker.active_jobs = worker.active_jobs.saturating_sub(1);
            }
        }
        Ok(())
    }

    pub fn get_job(&self, id: &Uuid) -> Option<&NclJob> {
        self.jobs.get(id)
    }

    pub fn queued_count(&self) -> usize {
        self.jobs.values().filter(|j| j.status == NclJobStatus::Queued).count()
    }

    pub fn active_count(&self) -> usize {
        self.jobs.values()
            .filter(|j| matches!(j.status, NclJobStatus::Assigned | NclJobStatus::Running))
            .count()
    }

    pub fn worker_count(&self) -> usize {
        self.workers.len()
    }

    pub fn online_workers(&self) -> usize {
        self.workers.values().filter(|w| w.online).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_job(backend: ComputeBackend) -> NclJob {
        NclJob::new(
            "test-model".into(),
            backend,
            "input".into(),
            "zion1user".into(),
            100_000,
            30_000,
        )
    }

    fn test_worker(id: &str, backends: Vec<ComputeBackend>) -> NclWorker {
        NclWorker::new(id.into(), "addr".into(), backends)
    }

    #[test]
    fn test_submit_job() {
        let mut sched = JobScheduler::new(100);
        let job = test_job(ComputeBackend::OnnxRuntime);
        let id = sched.submit_job(job).unwrap();
        assert_eq!(sched.queued_count(), 1);
        assert!(sched.get_job(&id).is_some());
    }

    #[test]
    fn test_queue_full() {
        let mut sched = JobScheduler::new(1);
        sched.submit_job(test_job(ComputeBackend::OnnxRuntime)).unwrap();
        assert!(sched.submit_job(test_job(ComputeBackend::OnnxRuntime)).is_err());
    }

    #[test]
    fn test_assign_job() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::OnnxRuntime]));
        sched.submit_job(test_job(ComputeBackend::OnnxRuntime)).unwrap();

        let result = sched.try_assign_next().unwrap();
        assert!(result.is_some());
        let (job_id, worker_id) = result.unwrap();
        assert_eq!(worker_id, "w1");
        assert_eq!(sched.queued_count(), 0);
        assert_eq!(sched.active_count(), 1);
    }

    #[test]
    fn test_no_worker_available() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::Wasm]));
        sched.submit_job(test_job(ComputeBackend::OnnxRuntime)).unwrap();

        let result = sched.try_assign_next();
        assert!(result.is_err()); // No ONNX worker
    }

    #[test]
    fn test_complete_job() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::OnnxRuntime]));
        let job = test_job(ComputeBackend::OnnxRuntime);
        let id = sched.submit_job(job).unwrap();
        sched.try_assign_next().unwrap();

        sched.complete_job(id, "output_hash".into()).unwrap();
        let job = sched.get_job(&id).unwrap();
        assert_eq!(job.status, NclJobStatus::Completed);
        assert_eq!(job.output_hash.as_deref(), Some("output_hash"));
    }

    #[test]
    fn test_fail_job() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::OnnxRuntime]));
        let job = test_job(ComputeBackend::OnnxRuntime);
        let id = sched.submit_job(job).unwrap();
        sched.try_assign_next().unwrap();

        sched.fail_job(id, "OOM").unwrap();
        let job = sched.get_job(&id).unwrap();
        assert_eq!(job.status, NclJobStatus::Failed);
    }

    #[test]
    fn test_worker_stats_after_completion() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::OnnxRuntime]));
        let job = test_job(ComputeBackend::OnnxRuntime);
        let reward = job.reward_atomic;
        let id = sched.submit_job(job).unwrap();
        sched.try_assign_next().unwrap();
        sched.complete_job(id, "out".into()).unwrap();

        // Worker should be back to 0 active, 1 completed
        assert_eq!(sched.online_workers(), 1);
    }
}
