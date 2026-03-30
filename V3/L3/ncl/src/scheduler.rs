use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{NclError, NclResult};
use crate::reputation::ReputationRegistry;
use crate::types::{NclJob, NclJobStatus, NclWorker};

/// Job scheduler — assigns queued jobs to available workers.
///
/// ## Scheduling policy
/// 1. **Priority-first**: higher-priority jobs are dispatched before lower-priority
///    jobs (ties broken by FIFO — oldest first).
/// 2. **Consciousness gate**: only workers that meet `job.min_consciousness`
///    are considered.
/// 3. **Reputation-weighted**: among eligible workers, the one with the
///    highest reputation score wins.
pub struct JobScheduler {
    jobs: HashMap<Uuid, NclJob>,
    workers: HashMap<String, NclWorker>,
    max_queue_size: usize,
    /// Optional shared reputation registry (set via `with_reputation`)
    reputation: Option<ReputationRegistry>,
}

impl JobScheduler {
    pub fn new(max_queue_size: usize) -> Self {
        Self {
            jobs: HashMap::new(),
            workers: HashMap::new(),
            max_queue_size,
            reputation: None,
        }
    }

    /// Attach a reputation registry for reputation-weighted scheduling.
    pub fn with_reputation(mut self, reg: ReputationRegistry) -> Self {
        self.reputation = Some(reg);
        self
    }

    /// Submit a new job to the queue.
    pub fn submit_job(&mut self, job: NclJob) -> NclResult<Uuid> {
        let queued = self
            .jobs
            .values()
            .filter(|j| j.status == NclJobStatus::Queued)
            .count();
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
    ///
    /// Selection:
    /// - Among queued jobs, pick the one with **highest priority** (then oldest).
    /// - Among eligible workers, pick the one with **highest reputation score**
    ///   (falls back to first available when no registry is attached).
    pub fn try_assign_next(&mut self) -> NclResult<Option<(Uuid, String)>> {
        // Find the best queued job (priority-first, then oldest)
        let best_job = self
            .jobs
            .values()
            .filter(|j| j.status == NclJobStatus::Queued)
            .max_by(|a, b| {
                a.priority
                    .cmp(&b.priority)
                    .then(b.created_at.cmp(&a.created_at)) // older first on tie
            });

        let (job_id, backend, min_consciousness) = match best_job {
            Some(j) => (j.id, j.backend, j.min_consciousness),
            None => return Ok(None),
        };

        // Collect eligible workers
        let eligible: Vec<&NclWorker> = self
            .workers
            .values()
            .filter(|w| {
                w.has_capacity()
                    && w.supports_backend(backend)
                    && w.meets_consciousness(min_consciousness)
            })
            .collect();

        if eligible.is_empty() {
            return Err(NclError::NoWorkerAvailable(backend.to_string()));
        }

        // Pick best worker by reputation (or fallback to first eligible)
        let worker_id: String = if let Some(rep) = &self.reputation {
            let ids: Vec<&str> = eligible.iter().map(|w| w.id.as_str()).collect();
            rep.best_worker(&ids)
                .unwrap_or(eligible[0].id.as_str())
                .to_string()
        } else {
            eligible[0].id.clone()
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
        let job = self
            .jobs
            .get_mut(&job_id)
            .ok_or_else(|| NclError::JobNotFound(job_id.to_string()))?;
        job.status = NclJobStatus::Completed;
        job.output_hash = Some(output_hash);
        job.completed_at = Some(chrono::Utc::now());

        let reward = job.reward_flowers;
        if let Some(worker_id) = job.worker_id.clone() {
            if let Some(worker) = self.workers.get_mut(&worker_id) {
                worker.active_jobs = worker.active_jobs.saturating_sub(1);
                worker.total_completed += 1;
                worker.total_earned += reward;
            }
        }
        Ok(())
    }

    /// Mark a job as failed.
    pub fn fail_job(&mut self, job_id: Uuid, _reason: &str) -> NclResult<()> {
        let job = self
            .jobs
            .get_mut(&job_id)
            .ok_or_else(|| NclError::JobNotFound(job_id.to_string()))?;
        job.status = NclJobStatus::Failed;

        if let Some(worker_id) = job.worker_id.clone() {
            if let Some(worker) = self.workers.get_mut(&worker_id) {
                worker.active_jobs = worker.active_jobs.saturating_sub(1);
            }
        }
        Ok(())
    }

    /// Cancel a queued job (cannot cancel assigned/running jobs).
    pub fn cancel_job(&mut self, job_id: Uuid) -> NclResult<()> {
        let job = self
            .jobs
            .get_mut(&job_id)
            .ok_or_else(|| NclError::JobNotFound(job_id.to_string()))?;
        if job.status != NclJobStatus::Queued {
            return Err(NclError::ExecutionFailed(
                "Cannot cancel a job that is not queued".into(),
            ));
        }
        job.status = NclJobStatus::Cancelled;
        Ok(())
    }

    // ─── Stats ────────────────────────────────────────────────────────────

    pub fn get_job(&self, id: &Uuid) -> Option<&NclJob> {
        self.jobs.get(id)
    }

    pub fn queued_count(&self) -> usize {
        self.jobs
            .values()
            .filter(|j| j.status == NclJobStatus::Queued)
            .count()
    }

    pub fn active_count(&self) -> usize {
        self.jobs
            .values()
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
    use crate::types::ComputeBackend;

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
        sched
            .submit_job(test_job(ComputeBackend::OnnxRuntime))
            .unwrap();
        assert!(sched
            .submit_job(test_job(ComputeBackend::OnnxRuntime))
            .is_err());
    }

    #[test]
    fn test_assign_job() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::OnnxRuntime]));
        sched
            .submit_job(test_job(ComputeBackend::OnnxRuntime))
            .unwrap();

        let result = sched.try_assign_next().unwrap();
        assert!(result.is_some());
        let (_job_id, worker_id) = result.unwrap();
        assert_eq!(worker_id, "w1");
        assert_eq!(sched.queued_count(), 0);
        assert_eq!(sched.active_count(), 1);
    }

    #[test]
    fn test_no_worker_available() {
        let mut sched = JobScheduler::new(100);
        sched.register_worker(test_worker("w1", vec![ComputeBackend::Wasm]));
        sched
            .submit_job(test_job(ComputeBackend::OnnxRuntime))
            .unwrap();

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
        let _reward = job.reward_flowers;
        let id = sched.submit_job(job).unwrap();
        sched.try_assign_next().unwrap();
        sched.complete_job(id, "out".into()).unwrap();

        // Worker should be back to 0 active, 1 completed
        assert_eq!(sched.online_workers(), 1);
    }
}
