# EPIC Stratum TLS Protocol — Implementation Report

**Date:** 2026-07-14
**Status:** COMPLETE — E2E verified on Edge server (62.171.141.136)
**Commits:** `54514c3fc`, `41c350b97`

---

## 1. Overview

Implemented full EPIC ProgPow stratum protocol support in the ZION pool's `AuxPowClient`, enabling the B2b bridge to connect to `de.epicmine.io:3334` and forward ProgPow jobs to ZION miners.

EPIC uses a **custom JSON-RPC 2.0 protocol over TLS** — not Stratum v1. This required:
- TLS support (via `tokio-rustls` + `webpki-roots`)
- JSON-RPC 2.0 framing (`"jsonrpc": "2.0"` in every request)
- EPIC-specific methods (`login`, `getjobtemplate`, `submit`, `keepalive`)
- String ID handling (EPIC sends `"0"`, `"1"`, `"epicmine_stratum"` as IDs)
- Nested difficulty array parsing (`[["cuckoo",3],["randomx",N],["progpow",N]]`)
- Seed hash as integer array (not hex string)

---

## 2. Protocol Details

### 2.1 Connection

| Property | Value |
|----------|-------|
| Pool | `de.epicmine.io:3334` |
| Transport | TLS (rustls, aws-lc-rs CryptoProvider) |
| Protocol | JSON-RPC 2.0 (newline-delimited) |
| Username limit | 5–20 chars (wallet.worker) |
| Password limit | ≥ 8 chars |

### 2.2 Login

```json
→ {"jsonrpc":"2.0","id":1,"method":"login","params":{"login":"ziontest.pool","pass":"zion1234567","agent":"zion-auxpow/0.1"}}
← {"id":"1","jsonrpc":"2.0","method":"login","result":"ok","error":null}
```

### 2.3 GetJobTemplate (fire-and-forget)

```json
→ {"jsonrpc":"2.0","id":10,"method":"getjobtemplate","params":{"algorithm":"progpow"}}
← {"id":"epicmine_stratum","jsonrpc":"2.0","method":"job","params":{...job data...}}
```

Server responds with a different ID (`"epicmine_stratum"`) and pushes `job` notifications periodically. The `getjobtemplate` request is fire-and-forget — the poll loop handles the job notification.

### 2.4 Job Notification

```json
{"id":"epicmine_stratum","jsonrpc":"2.0","method":"job","params":{
  "algorithm":"progpow",
  "height":3620860,
  "job_id":6,
  "pre_pow":"00060000000000373ff8000000006a5698...(548 bytes hex)",
  "difficulty":[["cuckoo",3],["randomx",800000],["progpow",2500000000]],
  "block_difficulty":[["cuckoo",17475934],["randomx",584275583],["progpow",526630508509]],
  "epochs":[[3620060,3621060,[61,174,189,67,...32 bytes...]]],
  "xn":null
}}
```

### 2.5 Submit

```json
→ {"jsonrpc":"2.0","id":20,"method":"submit","params":{
  "height":3620860,
  "job_id":6,
  "nonce":12345,
  "pow":{"ProgPow":[0,255,128,...32 bytes as integer array...]}
}}
```

### 2.6 Keepalive

```json
→ {"jsonrpc":"2.0","id":0,"method":"keepalive","params":{}}
```

Sent every 30 seconds.

### 2.7 Error Codes

| Code | Meaning | Fatal? |
|------|---------|--------|
| -32000 | Node syncing | No — wait for pushed jobs |
| -30599 | Invalid agent | Yes |
| -30600 | Login error (username too short/long) | Yes |
| -32500 | Login first | Yes |
| -32501 | Low diff | No |
| -32502 | Failed validate | No |
| -32503 | Too late | No |

---

## 3. Implementation Details

### 3.1 Files Changed

| File | Changes |
|------|---------|
| `AuXpow/Cargo.toml` | Added `tokio-rustls`, `webpki-roots`, `rustls-pki-types` deps |
| `AuXpow/src/auxpow_client.rs` | +500 lines: EpicStratum protocol, TLS, job parsing, submit, keepalive |

### 3.2 Key Design Decisions

#### 3.2.1 Generalized Stream/Reader Types

Changed `OwnedWriteHalf`/`OwnedReadHalf` to `Box<dyn AsyncWrite + Unpin + Send>` / `Box<dyn AsyncRead + Unpin + Send>` to support both plain TCP and TLS connections with the same struct.

```rust
// Before:
stream: Arc<Mutex<Option<OwnedWriteHalf>>>,
reader: Arc<Mutex<Option<BufReader<OwnedReadHalf>>>>,

// After:
stream: Arc<Mutex<Option<Box<dyn AsyncWrite + Unpin + Send>>>>,
reader: Arc<Mutex<Option<BufReader<Box<dyn AsyncRead + Unpin + Send>>>>>,
```

#### 3.2.2 TLS Connection

EPIC requires TLS. The `connect_tcp()` method now branches on protocol:

```rust
if self.protocol == StratumProtocol::EpicStratum {
    let _ = tokio_rustls::rustls::crypto::aws_lc_rs::default_provider()
        .install_default();
    let roots = RootCertStore {
        roots: webpki_roots::TLS_SERVER_ROOTS.iter().cloned().collect(),
    };
    let config = tokio_rustls::rustls::ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let domain = ServerName::try_from(self.profile.pool_host.clone())?;
    let tls_stream = connector.connect(domain, tcp_stream).await?;
    // Split into reader/writer...
}
```

**CryptoProvider:** Both `aws-lc-rs` and `ring` are present in the dependency tree (ring via reqwest). Rustls can't auto-select, so we explicitly install `aws-lc-rs` as the process-level default.

#### 3.2.3 Poll Loop Ordering

For EPIC, login must complete **before** the poll loop spawns, because `send_request_inline` and `poll_messages` compete for the same reader mutex. If the poll loop spawns first, it can steal the login response.

```rust
// EPIC: login BEFORE poll loop
if self.protocol == StratumProtocol::EpicStratum {
    self.epic_login(payout_wallet).await?;
    self.epic_getjobtemplate().await?;
    self.start_epic_keepalive().await;
}
// THEN spawn poll loop
tokio::spawn(async move { /* poll_messages loop */ });
// Non-EPIC: subscribe/authorize AFTER poll loop (as before)
```

#### 3.2.4 Fire-and-Forget GetJobTemplate

The EPIC server responds to `getjobtemplate` with a `job` notification that has a different ID (`"epicmine_stratum"`). Using `send_request_inline` would hang waiting for a matching ID. Instead, we send the request fire-and-forget and let the poll loop handle the job notification.

#### 3.2.5 String ID Matching

EPIC sends IDs as strings (`"0"`, `"1"`, `"epicmine_stratum"`). The `send_request_inline` method now parses both integer and string IDs:

```rust
let resp_id = parsed.get("id").and_then(|v| {
    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
});
```

Additionally, for EPIC error responses where the ID doesn't match, we match by `method` field to avoid picking up errors from other requests.

#### 3.2.6 Difficulty Parsing

EPIC sends difficulty as a nested array of `[algo_name, diff_value]` pairs:

```json
"difficulty":[["cuckoo",3],["randomx",800000],["progpow",2500000000]]
```

We extract the `progpow` entry and derive the target via `difficulty_to_target()`.

#### 3.2.7 Seed Hash Parsing

EPIC sends the DAG seed as an array of integers (bytes), not a hex string:

```json
"epochs":[[3620060,3621060,[61,174,189,67,...32 bytes...]]]
```

We convert the integer array to a hex string for compatibility with the existing DAG management code.

#### 3.2.8 Algorithm Forcing

EPIC job responses have `"algorithm":"randomx"` at the top level (covering all 3 algorithms). We force the algorithm to `"progpow"` since we only mine ProgPow.

#### 3.2.9 Username Length Handling

EPIC requires username (wallet.worker) between 5 and 20 characters. If the payout wallet is too long, we use `"ziontest"` as a fallback (8 chars + ".pool" = 13 chars total).

---

## 4. E2E Verification

### 4.1 Live Test on Edge Server

**Date:** 2026-07-14 22:19 CEST
**Server:** 62.171.141.136 (Edge primary)
**Pool binary:** `/usr/local/bin/zion-pool-server` (rebuilt from `41c350b97`)

### 4.2 Log Output

```
auxpow_bridge: enabled coin=Some(EPIC) wallet=epic1qz0z0z0z0z0z0z0z0z0z0z0z0z0z0z0z0z0z0 worker=pool
auxpow: EPIC login as ziontest.pool (len=13) on EPIC (protocol=epicstratum)
auxpow: EPIC raw response: {"id":"1","jsonrpc":"2.0","method":"login","result":"ok","error":null}
auxpow: EPIC login successful for EPIC
auxpow: EPIC getjobtemplate sent (fire-and-forget)
auxpow: EPIC job parsed height=3620860 job_id=6 pre_pow_len=548 epoch=Some(120) share_diff=2500000000
auxpow_bridge: queued job_id=6 coin=EPIC algo=progpow
parallel_stream_embedded miner=5070Ti coin=EPIC algo=progpow ext_job_id=6 height=3620860
parallel_stream_embedded miner=vega-smos coin=EPIC algo=progpow ext_job_id=6 height=3620860
```

### 4.3 Wire Job (forwarded to miners)

```json
{
  "type": "job",
  "job_id": 5849,
  "algorithm": "deeksha_lite_v1",
  "external_stream": {
    "coin": "EPIC",
    "algorithm": "progpow",
    "job_id": "8",
    "header_hex": "00060000000000373ff8000000006a5698...(548 bytes)",
    "target_hex": "00000001b7cdfd9d7bdbab7d6ae6881cb5109a365f7e0df99d2255b971b0845d",
    "height": 3620856,
    "protocol": "stratum"
  }
}
```

### 4.4 Verification Checklist

| Step | Status |
|------|--------|
| TLS connection to de.epicmine.io:3334 | ✅ |
| Login (JSON-RPC 2.0) | ✅ `result: "ok"` |
| GetJobTemplate (fire-and-forget) | ✅ |
| Job notification received | ✅ height=3620860, job_id=6 |
| Job parsed (pre_pow, difficulty, epochs) | ✅ pre_pow_len=548, epoch=120 |
| Job queued to bridge | ✅ `algo=progpow` |
| Job forwarded to miners | ✅ 5070Ti + vega-smos |
| VRSC auxpow still active (no regression) | ✅ |
| Pool server stable (no panic/crash) | ✅ |

---

## 5. Edge Server Configuration

### 5.1 Current Environment

```bash
# /etc/zion/edge-environment.sh
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_COIN=EPIC                    # B2b bridge → EPIC
ZION_POOL_AUXPOW_WALLET=epic1qz0z0z0z0z0z0z0z0z0z0z0z0z0z0z0z0z0z0
ZION_POOL_AUXPOW_WORKER_NAME=pool             # Short name (≤20 char limit)
```

### 5.2 Revenue Streams (unchanged)

```bash
ZION_REVENUE_MULTISTREAM=1
ZION_STREAM_ZION_PCT=50
ZION_STREAM_NCL_PCT=25
ZION_STREAM_VERUSHASH_PCT=25
```

---

## 6. Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           Edge Pool Server               │
                    │         (62.171.141.136:8444)            │
                    │                                          │
  de.epicmine.io    │  ┌─────────────┐    ┌──────────────┐     │
  :3334 (TLS)  ←────┼──│ AuxPowClient │←──│JobMultiplexer│     │
  EPIC ProgPow      │  │ EpicStratum  │    └──────┬───────┘     │
                    │  └─────────────┘           │             │
                    │                            ▼             │
                    │  ┌──────────────────────────────────┐    │
                    │  │        Revenue Scheduler          │    │
                    │  │  zion:50% │ ncl:25% │ verushash:25%│   │
                    │  └──────────────────────────────────┘    │
                    │                            │             │
                    │                            ▼             │
                    │  ┌──────────────────────────────────┐    │
                    │  │     Session Threads → Miners      │    │
                    │  │  5070Ti │ vega-smos │ barker ...  │    │
                    │  └──────────────────────────────────┘    │
                    └──────────────────────────────────────────┘
                                         │
                                         ▼
                              ZION miners mine deeksha_lite_v1
                              + external EPIC ProgPow jobs
                              (embedded in wire_job.external_stream)
```

---

## 7. Commits

| Hash | Message |
|------|---------|
| `54514c3fc` | `feat(auxpow): add EpicStratum TLS protocol for EPIC ProgPow pool` |
| `41c350b97` | `fix(auxpow): EPIC protocol fixes — JSON-RPC 2.0, fire-and-forget getjobtemplate, poll loop ordering` |

---

## 8. Next Steps

1. **Miner-side ProgPow hashing** — The miner (`V3/L1/miner`) has ProgPow GPU support (DAG management, `scan_progpow`), but the full hash pipeline from `pre_pow` → ProgPow hash → mix_hash needs end-to-end testing with a real GPU
2. **EPIC share submission** — The `submit_share` method sends `{pow: {ProgPow: [mixHash]}}` but hasn't been tested with a real share yet (EPIC share difficulty is 2.5 billion — very high)
3. **`ZION_STREAM_PROGPOW_PCT`** — Set this env var on Edge to enable EPIC as a dedicated revenue lane (currently EPIC runs via the B2b bridge only)
4. **EPIC wallet** — Replace the test wallet `epic1qz0z0z0z0...` with a real EPIC wallet for payout collection
5. **Profit switching** — Add EPIC profitability estimates to the profit router for auto-switching between DCR/VRSC/EPIC

---

## 9. Dependencies Added

| Crate | Version | Purpose |
|-------|---------|---------|
| `tokio-rustls` | 0.26 | Async TLS client |
| `webpki-roots` | 1.0 | Mozilla CA certificate bundle |
| `rustls-pki-types` | 1.0 | ServerName type for TLS |

All three are already in the workspace `Cargo.lock` via `reqwest`'s `rustls-tls` feature — no new downloads required.
