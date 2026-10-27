use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

/// Parse an RPC URL into a TCP socket address.
///
/// Accepts `http://host:port`, `host:port` or `host` (defaulting to 9445).
pub fn parse_rpc_addr(rpc_url: &str) -> Result<SocketAddr> {
    let s = rpc_url.trim();
    let s = s
        .strip_prefix("http://")
        .or(s.strip_prefix("https://"))
        .unwrap_or(s);
    let s = s.split_once('/').map(|(h, _)| h).unwrap_or(s);

    if let Ok(addr) = s.parse::<SocketAddr>() {
        return Ok(addr);
    }
    if !s.contains(':') {
        return format!("{}:9445", s)
            .parse::<SocketAddr>()
            .with_context(|| format!("invalid RPC address: {}", rpc_url));
    }
    Err(anyhow!("invalid RPC address: {}", rpc_url))
}

/// Send a single JSON-RPC request over TCP and return the parsed response.
pub async fn jsonrpc_call(addr: SocketAddr, request: &Value) -> Result<Value> {
    let mut stream = TcpStream::connect(addr)
        .await
        .with_context(|| format!("failed to connect to {}", addr))?;

    let payload = format!("{}\n", request);
    stream
        .write_all(payload.as_bytes())
        .await
        .with_context(|| "failed to write RPC request")?;
    stream.flush().await?;

    let (reader, _) = stream.split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .with_context(|| "failed to read RPC response")?;

    serde_json::from_str(&line).with_context(|| "failed to parse RPC response")
}

/// Ordered L1 node RPC endpoints with last-good stickiness (F6 HA).
///
/// `l1_rpc_url` accepts a comma-separated list
/// (`http://127.0.0.1:9445,http://127.0.0.1:9446`).  Every call tries the
/// endpoint that last answered first — so when the primary is down,
/// steady-state calls go straight to the live follower instead of paying a
/// refused-connect tax on each attempt.
#[derive(Clone, Debug)]
pub struct L1Endpoints {
    addrs: Arc<Vec<SocketAddr>>,
    last_good: Arc<AtomicUsize>,
}

/// Per-attempt RPC bound. Overridable via `ZION_L1_RPC_TIMEOUT_MS`
/// (milliseconds); default 12 s — raised from 4 s after Edge G8 analysis
/// showed that under CPU saturation all three L1 nodes could simultaneously
/// exceed the old bound, dropping real block submits.
pub fn attempt_timeout() -> Duration {
    static CACHED: std::sync::OnceLock<Duration> = std::sync::OnceLock::new();
    *CACHED.get_or_init(|| {
        let ms = std::env::var("ZION_L1_RPC_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v >= 500)
            .unwrap_or(12_000);
        Duration::from_millis(ms)
    })
}

impl L1Endpoints {
    /// Parse a (possibly comma-separated) URL list.  Entries that fail to
    /// parse are skipped; returns None only when nothing parses.
    pub fn from_urls(raw: &str) -> Option<Self> {
        let addrs: Vec<SocketAddr> = raw
            .split(',')
            .filter_map(|s| parse_rpc_addr(s.trim()).ok())
            .collect();
        if addrs.is_empty() {
            return None;
        }
        Some(Self {
            addrs: Arc::new(addrs),
            last_good: Arc::new(AtomicUsize::new(0)),
        })
    }

    pub fn is_empty(&self) -> bool {
        self.addrs.is_empty()
    }

    /// Short description for logs: "127.0.0.1:9445[+2]".
    pub fn describe(&self) -> String {
        match self.addrs.as_slice() {
            [] => String::from("<none>"),
            [a] => a.to_string(),
            [a, rest @ ..] => format!("{}[+{}]", a, rest.len()),
        }
    }

    /// Try the last-answering endpoint first, then walk the rest.
    /// Each attempt is bounded to `attempt_timeout()` so a wedged endpoint
    /// can't stall the caller; the first responder becomes the new last_good.
    ///
    /// On a CPU-saturated host (Edge: 4 cores, 3 L1 nodes ~80-99 % CPU each)
    /// the default 4 s bound produced "all 3 endpoints failed" bursts during
    /// which real PoW block submits were dropped. The bound is now 12 s and
    /// overridable via `ZION_L1_RPC_TIMEOUT_MS`.
    pub async fn call(&self, request: &Value) -> Result<Value> {
        let n = self.addrs.len();
        if n == 0 {
            return Err(anyhow!("no L1 RPC endpoints configured"));
        }
        let timeout = attempt_timeout();
        let start = self.last_good.load(Ordering::Relaxed) % n;
        let mut last_err = anyhow!("no endpoints");
        for i in 0..n {
            let idx = (start + i) % n;
            let addr = self.addrs[idx];
            match tokio::time::timeout(timeout, jsonrpc_call(addr, request)).await {
                Ok(Ok(v)) => {
                    if idx != start {
                        self.last_good.store(idx, Ordering::Relaxed);
                    }
                    return Ok(v);
                }
                Ok(Err(e)) => {
                    last_err = e;
                    tracing::debug!("l1 rpc {} failed: {}", addr, last_err);
                }
                Err(_) => {
                    last_err = anyhow!("l1 rpc {} timed out after {:?}", addr, timeout);
                    tracing::debug!("{}", last_err);
                }
            }
        }
        Err(last_err.context(format!("all {} L1 endpoints failed", n)))
    }

    /// Number of configured endpoints.
    pub fn len(&self) -> usize {
        self.addrs.len()
    }

    /// Call one specific endpoint (index into `addrs`) with its own bound —
    /// used by the block-submit tip-affinity probe, which must query each
    /// endpoint individually instead of following `last_good`.
    pub async fn call_addr(
        &self,
        idx: usize,
        request: &Value,
        timeout: Duration,
    ) -> Result<Value> {
        let addr = *self
            .addrs
            .get(idx)
            .ok_or_else(|| anyhow!("endpoint index {} out of range", idx))?;
        match tokio::time::timeout(timeout, jsonrpc_call(addr, request)).await {
            Ok(Ok(v)) => Ok(v),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(anyhow!("l1 rpc {} timed out after {:?}", addr, timeout)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    /// Spawn a TCP JSON-RPC server on a specific address; returns the task
    /// handle so tests can kill it (abort → port becomes refused).
    async fn spawn_server_on(addr: SocketAddr, result: Value) -> tokio::task::JoinHandle<()> {
        let listener = TcpListener::bind(addr).await.unwrap();
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let (reader, mut writer) = stream.into_split();
                let mut reader = BufReader::new(reader);
                let mut line = String::new();
                if reader.read_line(&mut line).await.is_err() {
                    continue;
                }
                let resp = format!(
                    "{}\n",
                    json!({ "jsonrpc": "2.0", "id": 1, "result": result })
                );
                let _ = writer.write_all(resp.as_bytes()).await;
            }
        })
    }

    /// Spawn a TCP JSON-RPC server on an ephemeral port; returns its addr.
    async fn spawn_server(result: Value) -> SocketAddr {
        let probe = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = probe.local_addr().unwrap();
        drop(probe);
        spawn_server_on(addr, result).await;
        addr
    }

    /// Get a guaranteed-refused port: bind then immediately drop.
    async fn dead_addr() -> SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        drop(listener);
        addr
    }

    #[test]
    fn from_urls_parses_single_endpoint() {
        let eps = L1Endpoints::from_urls("http://127.0.0.1:9445").unwrap();
        assert_eq!(eps.describe(), "127.0.0.1:9445");
    }

    #[test]
    fn from_urls_parses_comma_separated_list() {
        let eps =
            L1Endpoints::from_urls("http://127.0.0.1:9445, http://127.0.0.1:9446 ,127.0.0.1:9447")
                .unwrap();
        assert_eq!(eps.describe(), "127.0.0.1:9445[+2]");
    }

    #[test]
    fn from_urls_skips_invalid_entries() {
        let eps = L1Endpoints::from_urls("garbage,127.0.0.1:9445,http://bad:xx:yy").unwrap();
        assert_eq!(eps.describe(), "127.0.0.1:9445");
    }

    #[test]
    fn from_urls_returns_none_when_nothing_parses() {
        assert!(L1Endpoints::from_urls("garbage,bad:url:extra").is_none());
    }

    #[test]
    fn describe_shows_none_for_empty() {
        // Directly construct an empty set (from_urls never produces one).
        let eps = L1Endpoints {
            addrs: Arc::new(vec![]),
            last_good: Arc::new(AtomicUsize::new(0)),
        };
        assert_eq!(eps.describe(), "<none>");
        assert!(eps.is_empty());
    }

    #[tokio::test]
    async fn call_uses_single_endpoint() {
        let live = spawn_server(json!({ "h": 1 })).await;
        let eps = L1Endpoints::from_urls(&format!("http://{}", live)).unwrap();
        let resp = eps.call(&json!({"id":1})).await.unwrap();
        assert_eq!(resp["result"]["h"], 1);
    }

    #[tokio::test]
    async fn call_fails_over_to_follower_and_sticks() {
        let dead = dead_addr().await;
        let live = spawn_server(json!({ "ok": true })).await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", dead, live)).unwrap();

        // First call: primary refused → follower answers.
        let resp = eps.call(&json!({"id":1})).await.unwrap();
        assert_eq!(resp["result"]["ok"], true);
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 1);

        // Second call goes straight to last_good — primary skipped.
        let resp = eps.call(&json!({"id":2})).await.unwrap();
        assert_eq!(resp["result"]["ok"], true);
    }

    #[tokio::test]
    async fn call_sticks_to_follower_after_primary_recovers() {
        let dead = dead_addr().await;
        let live = spawn_server(json!({ "ok": true })).await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", dead, live)).unwrap();
        eps.call(&json!({"id":1})).await.unwrap();
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 1);

        // Bring a server up on the previously-dead primary port — last_good
        // must stay on the follower (no reason to churn back mid-incident).
        spawn_server_on(dead, json!({ "primary": true })).await;
        eps.call(&json!({"id":2})).await.unwrap();
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn call_fails_back_to_primary_when_follower_dies() {
        let dead = dead_addr().await;
        let follower_addr = dead_addr().await;
        let follower = spawn_server_on(follower_addr, json!({ "ok": true })).await;
        let eps =
            L1Endpoints::from_urls(&format!("http://{},http://{}", dead, follower_addr)).unwrap();
        eps.call(&json!({"id":1})).await.unwrap();
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 1);

        // Follower dies; primary comes back on its old port. Next call must
        // fail over back to the primary and re-stick.
        follower.abort();
        spawn_server_on(dead, json!({ "primary": true })).await;
        tokio::task::yield_now().await;
        let resp = eps.call(&json!({"id":2})).await.unwrap();
        assert_eq!(resp["result"]["primary"], true);
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn call_errors_when_all_endpoints_fail() {
        let a = dead_addr().await;
        let b = dead_addr().await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", a, b)).unwrap();
        let err = eps.call(&json!({"id":1})).await.unwrap_err().to_string();
        assert!(err.contains("all 2 L1 endpoints failed"), "got: {}", err);
    }

    #[tokio::test]
    async fn call_with_empty_endpoints_errors() {
        let eps = L1Endpoints {
            addrs: Arc::new(vec![]),
            last_good: Arc::new(AtomicUsize::new(0)),
        };
        let err = eps.call(&json!({"id":1})).await.unwrap_err().to_string();
        assert!(err.contains("no L1 RPC endpoints"), "got: {}", err);
    }

    #[tokio::test]
    async fn call_addr_targets_exact_endpoint_ignoring_last_good() {
        let a = spawn_server(json!({ "name": "a" })).await;
        let b = spawn_server(json!({ "name": "b" })).await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", a, b)).unwrap();
        assert_eq!(eps.len(), 2);

        // call() sets last_good to 0 — call_addr must still reach #1.
        eps.call(&json!({"id":1})).await.unwrap();
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 0);
        let resp = eps
            .call_addr(1, &json!({"id":2}), Duration::from_secs(2))
            .await
            .unwrap();
        assert_eq!(resp["result"]["name"], "b");

        // Out-of-range and dead indexes error instead of panicking.
        assert!(eps
            .call_addr(9, &json!({"id":3}), Duration::from_secs(1))
            .await
            .is_err());
    }
}
