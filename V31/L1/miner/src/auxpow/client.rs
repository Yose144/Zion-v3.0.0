use tracing::{info, warn};

use super::{Job, Share};

/// Stratum client for an external (AuxPoW) pool.
///
/// V31 scaffold keeps TCP/stratum framing unimplemented; the wire protocol will
/// be added once the runtime seam is stable. For now this type carries the
/// connection parameters and validates share submission parameters.
#[derive(Clone, Debug)]
pub struct StratumClient {
    pub url: String,
    pub worker: String,
    pub password: String,
}

impl StratumClient {
    pub fn new(
        url: impl Into<String>,
        worker: impl Into<String>,
        password: impl Into<String>,
    ) -> Self {
        Self {
            url: url.into(),
            worker: worker.into(),
            password: password.into(),
        }
    }

    /// Establish the stratum session.
    ///
    /// In the full implementation this subscribes to `mining.subscribe` and
    /// authorizes `worker`. The scaffold only logs the intent.
    pub async fn connect(&self) -> anyhow::Result<()> {
        info!(
            worker = %self.worker,
            url = %self.url,
            "stratum client connect (scaffold)"
        );
        Ok(())
    }

    /// Submit a share to the pool.
    pub async fn submit_share(&self, share: &Share) -> anyhow::Result<()> {
        if share.job_id.is_empty() {
            anyhow::bail!("share missing job_id");
        }
        info!(
            job_id = %share.job_id,
            coin = %share.coin,
            nonce = share.nonce,
            "submit share (scaffold)"
        );
        Ok(())
    }

    /// Notify the pool of a worker keep-alive / reconnect.
    pub async fn reconnect(&self, _last_job: Option<&Job>) {
        warn!(url = %self.url, "stratum reconnect (scaffold)");
    }
}
