use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
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

/// Parse a raw JSON-RPC response line into `T`. Shared by `call`,
/// `call_raw` and `call_typed` so the failover loop stays single-sourced
/// and parse failures keep counting as per-endpoint attempt failures.
type ResponseParser<'a, T> = &'a (dyn Fn(&str) -> Result<T> + Send + Sync);

/// Send a single JSON-RPC request over TCP, read the response line and
/// hand it to `parse`. Split from `jsonrpc_call` so typed callers can
/// skip the `serde_json::Value` tree on multi-MB payloads.
async fn jsonrpc_call_parsed<'a, T>(
    addr: SocketAddr,
    request: &Value,
    parse: ResponseParser<'a, T>,
) -> Result<T> {
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

    parse(&line)
}

/// Send a single JSON-RPC request over TCP and return the parsed response.
async fn jsonrpc_call(addr: SocketAddr, request: &Value) -> Result<Value> {
    jsonrpc_call_parsed(addr, request, &|line| {
        serde_json::from_str(line).with_context(|| "failed to parse RPC response")
    })
    .await
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

    /// Shared failover loop: tries the last-answering endpoint first,
    /// then walks the rest. Each attempt is bounded to
    /// `attempt_timeout()` so a wedged endpoint can't stall the caller;
    /// the first responder becomes the new last_good. `parse` runs inside
    /// the per-attempt timeout, so a malformed response counts as that
    /// endpoint failing and the next one is tried.
    async fn call_failover<T>(&self, request: &Value, parse: ResponseParser<'_, T>) -> Result<T> {
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
            match tokio::time::timeout(timeout, jsonrpc_call_parsed(addr, request, parse)).await {
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

    /// Try the last-answering endpoint first, then walk the rest.
    /// Each attempt is bounded to `attempt_timeout()` so a wedged endpoint
    /// can't stall the caller; the first responder becomes the new last_good.
    ///
    /// On a CPU-saturated host (Edge: 4 cores, 3 L1 nodes ~80-99 % CPU each)
    /// the default 4 s bound produced "all 3 endpoints failed" bursts during
    /// which real PoW block submits were dropped. The bound is now 12 s and
    /// overridable via `ZION_L1_RPC_TIMEOUT_MS`.
    pub async fn call(&self, request: &Value) -> Result<Value> {
        self.call_failover(request, &|line| {
            serde_json::from_str(line).with_context(|| "failed to parse RPC response")
        })
        .await
    }

    /// Like [`Self::call`] but deserializes straight into `T`, skipping
    /// the intermediate `serde_json::Value` tree. Use for payloads where
    /// the tree costs more than the data is worth — `getUtxos` on the
    /// pool wallet is ~27 MB of JSON and was the main driver of glibc
    /// arena bloat on EDGE1 (2026-11-13).
    pub async fn call_typed<T>(&self, request: &Value) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        self.call_failover(request, &|line| {
            serde_json::from_str(line).with_context(|| "failed to parse typed RPC response")
        })
        .await
    }

    /// Number of configured endpoints.
    pub fn len(&self) -> usize {
        self.addrs.len()
    }

    /// Broadcast a request to EVERY configured endpoint in parallel and
    /// pick the best response. Use for mempool submissions: mempools are
    /// node-local (there is no tx relay), so a `call()` that lands on one
    /// node leaves the others blind — templates built elsewhere never
    /// include the tx, and a sibling spend built against another node's
    /// mempool view double-spends it into a zombie that dies at
    /// template-build ("input not found"). Fanout makes every node hold
    /// the pending tx and mark its inputs spent.
    ///
    /// Prefers a non-rejection envelope (no `error` field and no
    /// `result.accepted == false`); falls back to the first rejection
    /// envelope; returns Err only when every attempt fails at transport.
    /// `last_good` is untouched — this is a broadcast, not a failover call.
    pub async fn call_all(&self, request: &Value) -> Result<Value> {
        let n = self.addrs.len();
        if n == 0 {
            return Err(anyhow!("no L1 RPC endpoints configured"));
        }
        if n == 1 {
            return self.call(request).await;
        }
        let timeout = attempt_timeout();
        let mut set = tokio::task::JoinSet::new();
        for idx in 0..n {
            let this = self.clone();
            let req = request.clone();
            set.spawn(async move { (idx, this.call_addr(idx, &req, timeout).await) });
        }
        let mut good: Option<Value> = None;
        let mut rejected: Option<Value> = None;
        let mut last_err: Option<anyhow::Error> = None;
        let (mut n_good, mut n_rejected, mut n_failed) = (0usize, 0usize, 0usize);
        while let Some(joined) = set.join_next().await {
            let (idx, result) = match joined {
                Ok(v) => v,
                Err(e) => {
                    n_failed += 1;
                    last_err = Some(anyhow!("broadcast task failed: {e}"));
                    continue;
                }
            };
            match result {
                Ok(v) => {
                    let is_reject = v.get("error").is_some_and(|e| !e.is_null())
                        || v.get("result")
                            .and_then(|r| r.get("accepted"))
                            .and_then(|a| a.as_bool())
                            == Some(false);
                    if is_reject {
                        n_rejected += 1;
                        tracing::debug!("l1 rpc {} rejected broadcast", self.addrs[idx]);
                        rejected.get_or_insert(v);
                    } else {
                        n_good += 1;
                        good.get_or_insert(v);
                    }
                }
                Err(e) => {
                    n_failed += 1;
                    tracing::debug!("l1 rpc {} broadcast failed: {}", self.addrs[idx], e);
                    last_err = Some(e);
                }
            }
        }
        if n_good + n_rejected + n_failed > 1 || n_rejected + n_failed > 0 {
            tracing::info!(
                "l1 broadcast: {n_good} accepted, {n_rejected} rejected, {n_failed} unreachable"
            );
        }
        good.or(rejected)
            .ok_or_else(|| last_err.unwrap_or_else(|| anyhow!("all {n} L1 endpoints failed")))
    }

    /// Call one specific endpoint (index into `addrs`) with its own bound —
    /// used by the block-submit tip-affinity probe, which must query each
    /// endpoint individually instead of following `last_good`.
    pub async fn call_addr(&self, idx: usize, request: &Value, timeout: Duration) -> Result<Value> {
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

/// `script_hex` visitor: decodes hex strings straight to bytes without
/// materializing the string, and tolerates any non-string JSON shape
/// (null/scalars → `Some(empty)`, matching the old
/// `as_str().unwrap_or("")` + `hex::decode(..).unwrap_or_default()` chain).
/// A missing key stays `None` — one call site skips those UTXOs.
struct ScriptHexVisitor;

impl<'de> serde::de::Visitor<'de> for ScriptHexVisitor {
    type Value = Option<Vec<u8>>;

    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str("script_hex string or null")
    }

    fn visit_str<E>(self, v: &str) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(hex::decode(v).unwrap_or_default()))
    }

    fn visit_string<E>(self, v: String) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(hex::decode(&v).unwrap_or_default()))
    }

    fn visit_unit<E>(self) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(Vec::new()))
    }

    fn visit_none<E>(self) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(None)
    }

    fn visit_some<D>(self, deserializer: D) -> std::result::Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_any(self)
    }

    fn visit_bool<E>(self, _v: bool) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(Vec::new()))
    }

    fn visit_i64<E>(self, _v: i64) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(Vec::new()))
    }

    fn visit_u64<E>(self, _v: u64) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(Vec::new()))
    }

    fn visit_f64<E>(self, _v: f64) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Some(Vec::new()))
    }

    fn visit_seq<A>(self, mut seq: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: serde::de::SeqAccess<'de>,
    {
        while seq.next_element::<serde::de::IgnoredAny>()?.is_some() {}
        Ok(Some(Vec::new()))
    }

    fn visit_map<A>(self, mut map: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: serde::de::MapAccess<'de>,
    {
        while map
            .next_entry::<serde::de::IgnoredAny, serde::de::IgnoredAny>()?
            .is_some()
        {}
        Ok(Some(Vec::new()))
    }
}

fn de_script_hex<'de, D>(deserializer: D) -> std::result::Result<Option<Vec<u8>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    deserializer.deserialize_any(ScriptHexVisitor)
}

// ── Lenient scalar field readers ─────────────────────────────────────
//
// The pre-typed code read every field through `Value::as_u64()` /
// `as_bool()` / `as_str()`, which degrade a wrong-typed field to `None`
// and skip just that entry. Plain `Option<T>` serde fields would instead
// fail the WHOLE ~27 MB response on a single malformed entry — a payout
// outage waiting for one weird historical UTXO. These helpers keep the
// old per-field tolerance while still skipping the Value tree: each
// field is parsed as a scalar `Value` (cheap) and converted with the
// same accessor the old code used.

pub(crate) fn de_opt_u64<'de, D>(deserializer: D) -> std::result::Result<Option<u64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Option::<Value>::deserialize(deserializer)?.and_then(|v| v.as_u64()))
}

pub(crate) fn de_opt_bool<'de, D>(deserializer: D) -> std::result::Result<Option<bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Option::<Value>::deserialize(deserializer)?.and_then(|v| v.as_bool()))
}

pub(crate) fn de_opt_str<'de, D>(deserializer: D) -> std::result::Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(match Option::<Value>::deserialize(deserializer)? {
        Some(Value::String(s)) => Some(s),
        _ => None,
    })
}

/// `utxos` as raw per-entry JSON. Each element is captured verbatim
/// (`Box<RawValue>`) and parsed into `UtxoSetEntry` lazily by the caller —
/// a structurally malformed element (string/number/…) fails only its own
/// `from_str`, never the whole set, matching the old `filter_map` skips.
/// A non-sequence `utxos` value degrades to `None` like `as_array()` did.
fn de_opt_utxo_vec<'de, D>(
    deserializer: D,
) -> std::result::Result<Option<Vec<Box<serde_json::value::RawValue>>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct UtxoVecVisitor;

    impl<'de> serde::de::Visitor<'de> for UtxoVecVisitor {
        type Value = Option<Vec<Box<serde_json::value::RawValue>>>;

        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("utxos array or null")
        }

        fn visit_seq<A>(self, mut seq: A) -> std::result::Result<Self::Value, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            let mut out = Vec::new();
            while let Some(raw) = seq.next_element::<Box<serde_json::value::RawValue>>()? {
                out.push(raw);
            }
            Ok(Some(out))
        }

        fn visit_unit<E>(self) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_map<A>(self, mut map: A) -> std::result::Result<Self::Value, A::Error>
        where
            A: serde::de::MapAccess<'de>,
        {
            while map
                .next_entry::<serde::de::IgnoredAny, serde::de::IgnoredAny>()?
                .is_some()
            {}
            Ok(None)
        }

        fn visit_bool<E>(self, _v: bool) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_i64<E>(self, _v: i64) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_u64<E>(self, _v: u64) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_f64<E>(self, _v: f64) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_str<E>(self, _v: &str) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_string<E>(self, _v: String) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
    }

    deserializer.deserialize_any(UtxoVecVisitor)
}

/// Lean typed view of a `getUtxos` JSON-RPC response. The pool wallet
/// holds ~90k UTXOs (~27 MB of JSON); going through `serde_json::Value`
/// built a multi-million-node tree per call — every payout round — and
/// was the main driver of glibc arena bloat on EDGE1 (2026-11-13).
/// Entries stay as raw JSON (`Box<RawValue>`) until `entries()` parses
/// them one by one, so a malformed element costs one skip, not the set.
#[derive(Debug, Default, Deserialize)]
pub struct UtxoSetResponse {
    #[serde(default)]
    pub result: Option<UtxoSetResult>,
    #[serde(default)]
    pub error: Option<Value>,
}

#[derive(Debug, Default, Deserialize)]
pub struct UtxoSetResult {
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub count: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_utxo_vec")]
    pub utxos: Option<Vec<Box<serde_json::value::RawValue>>>,
}

impl UtxoSetResult {
    /// Parsed UTXO entries; elements that fail to parse are skipped —
    /// same tolerance as the old `filter_map` chains.
    pub fn entries(&self) -> impl Iterator<Item = UtxoSetEntry> + '_ {
        self.utxos
            .iter()
            .flatten()
            .filter_map(|raw| serde_json::from_str(raw.get()).ok())
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct UtxoSetEntry {
    #[serde(default, deserialize_with = "de_opt_str")]
    pub tx_hash: Option<String>,
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub output_index: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub amount: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub block_height: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_bool")]
    pub is_coinbase: Option<bool>,
    #[serde(default, rename = "script_hex", deserialize_with = "de_script_hex")]
    pub script: Option<Vec<u8>>,
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
    async fn call_all_broadcasts_to_every_endpoint() {
        // Every live endpoint must receive the request — the whole point of
        // fanout is that each node's mempool holds the submitted tx.
        let hits_a = Arc::new(AtomicUsize::new(0));
        let hits_b = Arc::new(AtomicUsize::new(0));
        async fn spawn_counting(hits: Arc<AtomicUsize>) -> SocketAddr {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();
            tokio::spawn(async move {
                while let Ok((stream, _)) = listener.accept().await {
                    hits.fetch_add(1, Ordering::Relaxed);
                    let (reader, mut writer) = stream.into_split();
                    let mut reader = BufReader::new(reader);
                    let mut line = String::new();
                    if reader.read_line(&mut line).await.is_err() {
                        continue;
                    }
                    let resp = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"ok\":true}}\n";
                    let _ = writer.write_all(resp.as_bytes()).await;
                }
            });
            addr
        }
        let a = spawn_counting(hits_a.clone()).await;
        let b = spawn_counting(hits_b.clone()).await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", a, b)).unwrap();
        let resp = eps.call_all(&json!({"id":1})).await.unwrap();
        assert_eq!(resp["result"]["ok"], true);
        assert_eq!(hits_a.load(Ordering::Relaxed), 1);
        assert_eq!(hits_b.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn call_all_prefers_accept_over_rejection() {
        // One endpoint rejects (e.g. AlreadySpent sibling), another accepts —
        // the accepted envelope wins so the caller parses a tx_id.
        async fn spawn_raw(body: &'static str) -> SocketAddr {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();
            tokio::spawn(async move {
                while let Ok((stream, _)) = listener.accept().await {
                    let (reader, mut writer) = stream.into_split();
                    let mut reader = BufReader::new(reader);
                    let mut line = String::new();
                    if reader.read_line(&mut line).await.is_err() {
                        continue;
                    }
                    let _ = writer.write_all(body.as_bytes()).await;
                }
            });
            addr
        }
        let reject = spawn_raw("{\"jsonrpc\":\"2.0\",\"id\":1,\"error\":{\"code\":-1,\"message\":\"already spent\"}}\n").await;
        let accept =
            spawn_raw("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tx_id\":\"aa\"}}\n").await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", reject, accept)).unwrap();
        let resp = eps.call_all(&json!({"id":1})).await.unwrap();
        assert_eq!(resp["result"]["tx_id"], "aa");

        // All-reject returns a rejection envelope (caller requeues safely).
        let reject2 = spawn_raw(
            "{\"jsonrpc\":\"2.0\",\"id\":1,\"error\":{\"code\":-2,\"message\":\"nope\"}}\n",
        )
        .await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", reject, reject2)).unwrap();
        let resp = eps.call_all(&json!({"id":1})).await.unwrap();
        assert!(resp.get("error").is_some());
    }

    #[tokio::test]
    async fn call_all_survives_dead_endpoints() {
        // A live endpoint still wins when others are unreachable.
        let dead = dead_addr().await;
        let live = spawn_server(json!({ "tx_id": "bb" })).await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", dead, live)).unwrap();
        let resp = eps.call_all(&json!({"id":1})).await.unwrap();
        assert_eq!(resp["result"]["tx_id"], "bb");

        // All dead → Err.
        let dead2 = dead_addr().await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", dead, dead2)).unwrap();
        assert!(eps.call_all(&json!({"id":1})).await.is_err());
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

    // ── Typed path (`call_typed` / `UtxoSetResponse`) ─────────────────

    /// Spawn a TCP JSON-RPC server that answers every request with a
    /// fixed raw body — for malformed-payload failover tests.
    async fn spawn_body_server(body: &'static str) -> SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let (reader, mut writer) = stream.into_split();
                let mut reader = BufReader::new(reader);
                let mut line = String::new();
                if reader.read_line(&mut line).await.is_err() {
                    continue;
                }
                let _ = writer.write_all(body.as_bytes()).await;
            }
        });
        addr
    }

    #[tokio::test]
    async fn call_typed_parses_typed_response() {
        let body = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"h\":42}}\n";
        let addr = spawn_body_server(body).await;
        let eps = L1Endpoints::from_urls(&format!("http://{}", addr)).unwrap();

        #[derive(Debug, Deserialize, PartialEq)]
        struct Tip {
            h: u64,
        }
        #[derive(Debug, Deserialize)]
        struct Envelope {
            result: Tip,
        }
        let resp: Envelope = eps.call_typed(&json!({"id":1})).await.unwrap();
        assert_eq!(resp.result.h, 42);
    }

    #[tokio::test]
    async fn call_typed_fails_over_on_malformed_response() {
        // First endpoint emits syntactically invalid JSON — the parse
        // failure must count as an endpoint failure so the next one is
        // tried (same contract as `call`).
        let bad = spawn_body_server("this is not json\n").await;
        let good = spawn_body_server(
            "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"count\":1,\"utxos\":[]}}\n",
        )
        .await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", bad, good)).unwrap();

        #[derive(Debug, Deserialize)]
        struct Env {
            result: Option<serde_json::Map<String, Value>>,
        }
        let resp: Env = eps.call_typed(&json!({"id":1})).await.unwrap();
        assert!(resp.result.is_some());
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn call_typed_fails_over_on_type_mismatch() {
        // Valid JSON but `result` is a string where the DTO wants an
        // object — deserialize error must also fail over.
        let bad =
            spawn_body_server("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":\"garbage\"}\n").await;
        let good =
            spawn_body_server("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"count\":0}}\n").await;
        let eps = L1Endpoints::from_urls(&format!("http://{},http://{}", bad, good)).unwrap();

        let resp: UtxoSetResponse = eps.call_typed(&json!({"id":1})).await.unwrap();
        assert!(resp.result.is_some());
        assert_eq!(eps.last_good.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn utxo_set_response_parses_lenient_entries() {
        // One well-formed entry plus every malformed shape the old
        // `as_*()` chains tolerated: wrong-typed fields degrade to
        // None/empty, wrong-typed elements are skipped entirely.
        let json = r#"{
            "jsonrpc": "2.0", "id": 1,
            "result": {
                "count": 4,
                "utxos": [
                    {"tx_hash":"aabb","output_index":1,"amount":100,
                     "block_height":50,"is_coinbase":false,"script_hex":"deadbeef"},
                    {"tx_hash":"ccdd","output_index":"x","amount":1.5,
                     "block_height":null,"is_coinbase":"yes"},
                    "not-an-object",
                    {"tx_hash":123,"output_index":0,"amount":7,
                     "script_hex":null},
                    {"tx_hash":"eeff","output_index":2,"amount":9,
                     "block_height":70,"is_coinbase":true,"script_hex":"00"}
                ]
            }
        }"#;
        let resp: UtxoSetResponse = serde_json::from_str(json).unwrap();
        let result = resp.result.unwrap();
        assert_eq!(result.count, Some(4));

        let entries: Vec<UtxoSetEntry> = result.entries().collect();
        // "not-an-object" fails its own from_str → skipped; the other
        // three parse (fields degrade per-field, not per-response).
        assert_eq!(entries.len(), 4);

        let good = &entries[0];
        assert_eq!(good.tx_hash.as_deref(), Some("aabb"));
        assert_eq!(good.output_index, Some(1));
        assert_eq!(good.amount, Some(100));
        assert_eq!(good.block_height, Some(50));
        assert_eq!(good.is_coinbase, Some(false));
        assert_eq!(good.script.as_deref(), Some(&[0xde, 0xad, 0xbe, 0xef][..]));

        // Wrong-typed scalars → None (old `as_u64`/`as_bool`/`as_str`).
        let degraded = &entries[1];
        assert_eq!(degraded.tx_hash.as_deref(), Some("ccdd"));
        assert_eq!(degraded.output_index, None);
        assert_eq!(degraded.amount, None);
        assert_eq!(degraded.block_height, None);
        assert_eq!(degraded.is_coinbase, None);
        assert_eq!(degraded.script, None); // key missing → None

        // Numeric tx_hash → None; script_hex null → Some(empty).
        let odd = &entries[2];
        assert_eq!(odd.tx_hash, None);
        assert_eq!(odd.amount, Some(7));
        assert_eq!(odd.script.as_deref(), Some(&[][..]));

        let coinbase = &entries[3];
        assert_eq!(coinbase.is_coinbase, Some(true));
        assert_eq!(coinbase.block_height, Some(70));
        assert_eq!(coinbase.script.as_deref(), Some(&[0x00][..]));
    }

    #[test]
    fn utxo_set_response_tolerates_envelope_shapes() {
        // result null / missing → None; utxos non-array → empty; error
        // object captured without failing the parse.
        let resp: UtxoSetResponse =
            serde_json::from_str(r#"{"jsonrpc":"2.0","id":1,"result":null}"#).unwrap();
        assert!(resp.result.is_none());

        let resp: UtxoSetResponse =
            serde_json::from_str(r#"{"jsonrpc":"2.0","id":1,"error":{"code":-1}}"#).unwrap();
        assert!(resp.result.is_none());
        assert!(resp.error.is_some());

        let resp: UtxoSetResponse =
            serde_json::from_str(r#"{"result":{"count":"many","utxos":{"not":"an array"}}}"#)
                .unwrap();
        let result = resp.result.unwrap();
        assert_eq!(result.count, None); // string count → as_u64 parity
        assert_eq!(result.entries().count(), 0);

        // Syntactically broken JSON still fails — that is the transport-
        // level error path, not field tolerance.
        assert!(serde_json::from_str::<UtxoSetResponse>("{not json").is_err());
    }
}
