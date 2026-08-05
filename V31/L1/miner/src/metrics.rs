//! Miner metrics and Prometheus-style exposition.
//!
//! Tracks hash counts, share counts, reconnects, active pool and current
//! coin.  A lightweight HTTP server on a user-configurable port exposes
//! `# HELP` / `# TYPE` annotated text that Prometheus can scrape.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use anyhow::{Context, Result};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

/// Shared mining metrics.
#[derive(Clone)]
pub struct Metrics {
    inner: Arc<MetricsInner>,
}

struct MetricsInner {
    total_hashes: AtomicU64,
    shares_submitted: AtomicU64,
    shares_accepted: AtomicU64,
    shares_rejected: AtomicU64,
    jobs_received: AtomicU64,
    reconnect_count: AtomicU64,
    active_pool: Mutex<String>,
    active_coin: Mutex<String>,
    start: Instant,
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new("", "zion")
    }
}

impl Metrics {
    /// Create a new metrics instance bound to `pool` and initial `coin`.
    pub fn new(pool: impl Into<String>, coin: impl Into<String>) -> Self {
        Self {
            inner: Arc::new(MetricsInner {
                total_hashes: AtomicU64::new(0),
                shares_submitted: AtomicU64::new(0),
                shares_accepted: AtomicU64::new(0),
                shares_rejected: AtomicU64::new(0),
                jobs_received: AtomicU64::new(0),
                reconnect_count: AtomicU64::new(0),
                active_pool: Mutex::new(pool.into()),
                active_coin: Mutex::new(coin.into()),
                start: Instant::now(),
            }),
        }
    }

    pub fn record_hashes(&self, n: u64) {
        self.inner.total_hashes.fetch_add(n, Ordering::Relaxed);
    }

    pub fn inc_submitted(&self) {
        self.inner.shares_submitted.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_accepted(&self) {
        self.inner.shares_accepted.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_rejected(&self) {
        self.inner.shares_rejected.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_jobs(&self) {
        self.inner.jobs_received.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_reconnects(&self) {
        self.inner.reconnect_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn set_pool(&self, pool: impl Into<String>) {
        if let Ok(mut p) = self.inner.active_pool.lock() {
            *p = pool.into();
        }
    }

    pub fn set_coin(&self, coin: impl Into<String>) {
        if let Ok(mut c) = self.inner.active_coin.lock() {
            *c = coin.into();
        }
    }

    /// Current hashrate computed over the total runtime.
    pub fn hashrate(&self) -> f64 {
        let elapsed = self.inner.start.elapsed().as_secs_f64().max(0.1);
        let hashes = self.inner.total_hashes.load(Ordering::Relaxed);
        hashes as f64 / elapsed
    }

    /// Total hashes since startup.
    pub fn total_hashes(&self) -> u64 {
        self.inner.total_hashes.load(Ordering::Relaxed)
    }

    /// Total submitted shares.
    pub fn shares_submitted(&self) -> u64 {
        self.inner.shares_submitted.load(Ordering::Relaxed)
    }

    /// Total accepted shares.
    pub fn shares_accepted(&self) -> u64 {
        self.inner.shares_accepted.load(Ordering::Relaxed)
    }

    /// Total rejected shares.
    pub fn shares_rejected(&self) -> u64 {
        self.inner.shares_rejected.load(Ordering::Relaxed)
    }

    /// Number of `mining.notify` jobs received.
    pub fn jobs_received(&self) -> u64 {
        self.inner.jobs_received.load(Ordering::Relaxed)
    }

    /// Number of reconnects to the pool.
    pub fn reconnect_count(&self) -> u64 {
        self.inner.reconnect_count.load(Ordering::Relaxed)
    }

    fn active_pool(&self) -> String {
        self.inner
            .active_pool
            .lock()
            .map(|g| g.clone())
            .unwrap_or_default()
    }

    fn active_coin(&self) -> String {
        self.inner
            .active_coin
            .lock()
            .map(|g| g.clone())
            .unwrap_or_default()
    }

    /// Render the metrics as Prometheus exposition text.
    pub fn render(&self) -> String {
        let pool = Self::sanitize_label(&self.active_pool());
        let coin = Self::sanitize_label(&self.active_coin());
        let hash_rate = self.hashrate();

        format!(
            "# HELP zion_miner_hash_rate Hash rate in hashes per second.\n\
             # TYPE zion_miner_hash_rate gauge\n\
             zion_miner_hash_rate{{pool=\"{pool}\",coin=\"{coin}\"}} {hash_rate:.2}\n\
             # HELP zion_miner_total_hashes Total hashes computed.\n\
             # TYPE zion_miner_total_hashes counter\n\
             zion_miner_total_hashes{{pool=\"{pool}\",coin=\"{coin}\"}} {}\n\
             # HELP zion_miner_shares_submitted Total shares submitted.\n\
             # TYPE zion_miner_shares_submitted counter\n\
             zion_miner_shares_submitted{{pool=\"{pool}\",coin=\"{coin}\"}} {}\n\
             # HELP zion_miner_shares_accepted Total accepted shares.\n\
             # TYPE zion_miner_shares_accepted counter\n\
             zion_miner_shares_accepted{{pool=\"{pool}\",coin=\"{coin}\"}} {}\n\
             # HELP zion_miner_shares_rejected Total rejected shares.\n\
             # TYPE zion_miner_shares_rejected counter\n\
             zion_miner_shares_rejected{{pool=\"{pool}\",coin=\"{coin}\"}} {}\n\
             # HELP zion_miner_jobs_received Total mining.notify jobs received.\n\
             # TYPE zion_miner_jobs_received counter\n\
             zion_miner_jobs_received{{pool=\"{pool}\",coin=\"{coin}\"}} {}\n\
             # HELP zion_miner_reconnect_count Total pool reconnects.\n\
             # TYPE zion_miner_reconnect_count counter\n\
             zion_miner_reconnect_count{{pool=\"{pool}\",coin=\"{coin}\"}} {}\n",
            self.total_hashes(),
            self.shares_submitted(),
            self.shares_accepted(),
            self.shares_rejected(),
            self.jobs_received(),
            self.reconnect_count(),
        )
    }

    /// Format a one-line TUI log with hashrate, shares, active coin and pool.
    pub fn tui_log(&self) -> String {
        format!(
            "hashrate={:.0} H/s submitted={} accepted={} rejected={} jobs={} reconnects={} coin={} pool={}",
            self.hashrate(),
            self.shares_submitted(),
            self.shares_accepted(),
            self.shares_rejected(),
            self.jobs_received(),
            self.reconnect_count(),
            self.active_coin(),
            self.active_pool()
        )
    }

    /// Human-readable mining status summary.
    pub fn summary(&self) -> String {
        format!(
            "pool={} coin={} hashrate={:.0} H/s accepted={} rejected={}",
            self.active_pool(),
            self.active_coin(),
            self.hashrate(),
            self.shares_accepted(),
            self.shares_rejected()
        )
    }

    /// Escape label values for Prometheus text format.
    fn sanitize_label(s: &str) -> String {
        s.replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    }
}

/// Start a minimal HTTP metrics server on `bind_addr`.
pub async fn serve(metrics: Metrics, bind_addr: SocketAddr) -> Result<()> {
    let listener = TcpListener::bind(bind_addr)
        .await
        .with_context(|| format!("failed to bind metrics server to {bind_addr}"))?;
    tracing::info!("metrics server listening on http://{bind_addr}/metrics");

    loop {
        let (stream, peer) = listener.accept().await.context("metrics accept failed")?;
        let metrics = metrics.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_metrics_conn(stream, metrics).await {
                tracing::debug!("metrics connection from {peer} error: {e}");
            }
        });
    }
}

async fn handle_metrics_conn(mut stream: TcpStream, metrics: Metrics) -> Result<()> {
    let (rx, mut tx) = stream.split();
    let mut reader = BufReader::new(rx);
    let mut first_line = String::new();
    reader
        .read_line(&mut first_line)
        .await
        .context("failed to read HTTP request line")?;

    // Drain headers
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .await
            .context("failed to read header")?;
        if n == 0 || line.trim().is_empty() {
            break;
        }
    }

    let body = if first_line.starts_with("GET /metrics") || first_line.starts_with("get /metrics") {
        metrics.render()
    } else {
        "404 Not Found\n".to_string()
    };

    let status = if body.starts_with("404") {
        "404 Not Found"
    } else {
        "200 OK"
    };
    let response = format!(
        "HTTP/1.1 {status}\r\n\
         Content-Type: text/plain; version=0.0.4\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n{}",
        body.len(),
        body
    );

    tx.write_all(response.as_bytes()).await?;
    tx.flush().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metrics_render_contains_expected_counters() {
        let m = Metrics::new("127.0.0.1:8444", "zion");
        m.record_hashes(1234);
        m.inc_submitted();
        m.inc_accepted();
        m.inc_jobs();
        m.inc_reconnects();

        let text = m.render();
        assert!(text.contains("zion_miner_hash_rate"));
        assert!(text.contains("zion_miner_total_hashes"));
        assert!(text.contains("zion_miner_shares_submitted"));
        assert!(text.contains("zion_miner_shares_accepted"));
        assert!(text.contains("zion_miner_jobs_received"));
        assert!(text.contains("zion_miner_reconnect_count"));
        assert!(text.contains("1234"));
    }

    #[test]
    fn tui_log_contains_counters() {
        let m = Metrics::new("127.0.0.1:8444", "zion");
        m.record_hashes(1000);
        m.inc_submitted();
        m.inc_accepted();
        m.inc_rejected();
        m.set_coin("kaspa");

        let log = m.tui_log();
        assert!(log.contains("hashrate="));
        assert!(log.contains("submitted=1"));
        assert!(log.contains("accepted=1"));
        assert!(log.contains("rejected=1"));
        assert!(log.contains("coin=kaspa"));
        assert!(log.contains("pool=127.0.0.1:8444"));
    }

    #[test]
    fn sanitize_escapes_quotes() {
        assert_eq!(Metrics::sanitize_label("foo\"bar"), "foo\\\"bar");
    }
}
